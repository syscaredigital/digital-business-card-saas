(function () {
  'use strict';
  var API = window.SyncVCardApiOrigin + '/api/user';
  var enquiryDialog = document.getElementById('enquiryDialog');
  var decisionDialog = document.getElementById('appointmentDecisionDialog');
  var currentContact, currentAppointment, decision, replyKey;

  async function request(path, method, body) {
    var response = await window.SyncSession.fetch(API + path, {
      method: method || 'GET', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'SyncECard' },
      body: body ? JSON.stringify(body) : undefined
    });
    var data = await response.json();
    if (!response.ok) { var error = new Error(data.message || 'Unable to update your inbox'); error.status = response.status; throw error; }
    return data;
  }
  function feedback(id, message) { document.getElementById(id).textContent = message || ''; }
  function busy(dialog, enabled) {
    dialog.dataset.busy = enabled ? 'true' : '';
    dialog.querySelectorAll('button,textarea,select').forEach(function (node) { node.disabled = enabled; });
  }
  [enquiryDialog, decisionDialog].filter(Boolean).forEach(function (dialog) {
    dialog.querySelector('[data-close-owner-dialog]').addEventListener('click', function () { if (dialog.dataset.busy !== 'true') dialog.close(); });
    dialog.addEventListener('cancel', function (event) { if (dialog.dataset.busy === 'true') event.preventDefault(); });
  });

  async function loadConversation() {
    var data = await request('/enquiries/' + currentContact);
    var contact = data.enquiry;
    feedback('enquiryDialogTitle', contact.name || 'Conversation');
    feedback('enquiryDialogContact', [contact.vcard_name, contact.email, contact.phone, contact.company, contact.source].filter(Boolean).join(' · '));
    feedback('enquiryDialogMessage', contact.message || 'Contact details shared.');
    document.getElementById('enquiryDialogStatus').value = contact.enquiry_status;
    var history = document.getElementById('enquiryReplyHistory');
    history.replaceChildren();
    data.replies.forEach(function (reply) {
      var article = document.createElement('article'), label = document.createElement('strong'), message = document.createElement('p');
      article.className = 'owner-reply-entry';
      label.textContent = 'Your reply · ' + new Date(reply.created_at).toLocaleString() + ' · Email: ' + reply.email_status;
      message.textContent = reply.message;
      article.append(label, message); history.appendChild(article);
    });
    document.getElementById('enquiryReplyForm').hidden = !contact.email;
    if (!contact.email) feedback('enquiryDialogFeedback', 'No email was provided. Use the phone number above and update the status when done.');
  }
  async function openConversation(id) {
    currentContact = Number(id);
    if (!currentContact || !enquiryDialog) return;
    replyKey = null;
    document.getElementById('enquiryReplyMessage').value = '';
    feedback('enquiryDialogTitle', 'Loading conversation…');
    feedback('enquiryDialogFeedback', '');
    if (!enquiryDialog.open) enquiryDialog.showModal();
    busy(enquiryDialog, true);
    try {
      await loadConversation();
      await request('/enquiries/' + currentContact, 'PATCH', { read: true });
    } catch (error) { feedback('enquiryDialogFeedback', error.message); }
    finally { busy(enquiryDialog, false); }
  }
  if (enquiryDialog) {
    document.addEventListener('click', function (event) {
      var button = event.target.closest('[data-open-enquiry]');
      if (button) openConversation(button.dataset.openEnquiry);
    });
    document.getElementById('saveEnquiryStatus').addEventListener('click', async function () {
      busy(enquiryDialog, true);
      try {
        var data = await request('/enquiries/' + currentContact, 'PATCH', { status: document.getElementById('enquiryDialogStatus').value });
        feedback('enquiryDialogFeedback', data.message);
        window.dispatchEvent(new Event('owner-inbox-updated'));
      } catch (error) { feedback('enquiryDialogFeedback', error.message); }
      finally { busy(enquiryDialog, false); }
    });
    document.getElementById('enquiryReplyForm').addEventListener('submit', async function (event) {
      event.preventDefault();
      if (enquiryDialog.dataset.busy === 'true') return;
      // Retain this key after an uncertain network response; retry cannot send a second reply.
      if (!replyKey) replyKey = crypto.randomUUID();
      busy(enquiryDialog, true); feedback('enquiryDialogFeedback', 'Queuing your reply…');
      try {
        var data = await request('/enquiries/' + currentContact + '/replies', 'POST', { message: document.getElementById('enquiryReplyMessage').value, requestKey: replyKey });
        replyKey = null;
        document.getElementById('enquiryReplyMessage').value = '';
        feedback('enquiryDialogFeedback', data.message);
        await loadConversation();
        window.dispatchEvent(new Event('owner-inbox-updated'));
      } catch (error) { if (error.status >= 400 && error.status < 500) replyKey = null; feedback('enquiryDialogFeedback', error.message); }
      finally { busy(enquiryDialog, false); }
    });
    var initialKind = new URLSearchParams(location.search).get('kind');
    if (['contact', 'enquiry'].includes(initialKind)) document.getElementById('leadKindFilter').value = initialKind;
    function filterLeads() {
      var kind = document.getElementById('leadKindFilter').value, status = document.getElementById('leadStatusFilter').value;
      var search = document.getElementById('enquiriesSearch').value.trim().toLowerCase(), count = 0;
      document.querySelectorAll('#enquiriesTableBody .enquiry-row').forEach(function (row) {
        row.hidden = Boolean((kind && row.dataset.leadKind !== kind) || (status && row.dataset.leadStatus !== status) || (search && !row.dataset.search.includes(search)));
        if (!row.hidden) count++;
      });
      feedback('enquiriesResults', 'Showing ' + count + ' results');
    }
    ['leadKindFilter','leadStatusFilter','enquiriesSearch'].forEach(function (id) { document.getElementById(id).addEventListener('input', filterLeads); });
    window.addEventListener('owner-inbox-loaded', filterLeads);
    document.getElementById('refreshOwnerInbox').addEventListener('click', function () { window.dispatchEvent(new Event('owner-inbox-updated')); });
    var contactId = new URLSearchParams(location.search).get('contact');
    if (/^\d+$/.test(contactId || '')) openConversation(contactId);
  }

  async function decideAppointment(id, nextStatus) {
    currentAppointment = Number(id); decision = nextStatus;
    if (!currentAppointment || !decisionDialog) return;
    feedback('appointmentDecisionTitle', decision === 'approved' ? 'Approve appointment' : 'Decline appointment');
    feedback('appointmentDecisionFeedback', 'Loading appointment…');
    document.getElementById('appointmentDecisionNote').value = '';
    document.getElementById('appointmentDecisionForm').hidden = true;
    if (!decisionDialog.open) decisionDialog.showModal();
    busy(decisionDialog, true);
    try {
      var data = await request('/appointments');
      var item = data.appointments.find(function (row) { return Number(row.id) === currentAppointment; });
      if (!item) throw new Error('Appointment not found');
      feedback('appointmentDecisionDetails', [item.name, item.email, item.vcard_name, item.service_name, new Date(item.starts_at).toLocaleString(), item.appointment_type].filter(Boolean).join(' · '));
      feedback('appointmentDecisionNotes', item.notes || 'No additional notes.');
      if (item.status === 'pending') {
        document.getElementById('appointmentDecisionForm').hidden = false;
        feedback('appointmentDecisionSubmit', decision === 'approved' ? 'Approve & notify customer' : 'Decline & notify customer');
        feedback('appointmentDecisionFeedback', '');
      } else {
        feedback('appointmentDecisionTitle', 'Appointment ' + item.status);
        feedback('appointmentDecisionFeedback', 'Customer email: ' + (item.email_status || 'No email record') + (item.decision_note ? ' · ' + item.decision_note : ''));
      }
    } catch (error) { feedback('appointmentDecisionFeedback', error.message); }
    finally { busy(decisionDialog, false); }
  }
  window.SyncOwnerInbox = { decideAppointment: decideAppointment };
  if (decisionDialog) {
    document.getElementById('appointmentDecisionForm').addEventListener('submit', async function (event) {
      event.preventDefault();
      if (decisionDialog.dataset.busy === 'true') return;
      busy(decisionDialog, true);
      try {
        var data = await request('/appointments/' + currentAppointment + '/status', 'PATCH', { status: decision, note: document.getElementById('appointmentDecisionNote').value });
        feedback('appointmentsActionStatus', data.message);
        window.dispatchEvent(new Event('owner-appointments-updated'));
        decisionDialog.close();
      } catch (error) { feedback('appointmentDecisionFeedback', error.message); }
      finally { busy(decisionDialog, false); }
    });
    var appointmentId = new URLSearchParams(location.search).get('appointment');
    if (/^\d+$/.test(appointmentId || '')) decideAppointment(appointmentId, 'approved');
  }
  window.setInterval(function () {
    if (document.visibilityState !== 'visible' || (enquiryDialog && enquiryDialog.open) || (decisionDialog && decisionDialog.open)) return;
    window.dispatchEvent(new Event(enquiryDialog ? 'owner-inbox-updated' : 'owner-appointments-updated'));
  }, 30000);
})();
