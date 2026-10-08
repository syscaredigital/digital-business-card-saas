(function () {
  'use strict';

  async function publicFetch(input, options) {
    var origin = window.SyncVCardApiOrigin || window.location.origin;
    var target = new URL(input, window.location.href);
    if (target.origin !== new URL(origin).origin || !target.pathname.startsWith('/api/public/')) {
      throw new Error('Unexpected public API destination');
    }
    var response;
    try {
      response = await window.fetch(target.href, Object.assign({}, options, { credentials: 'omit' }));
    } catch (_) {
      throw new Error('Unable to connect. Check your connection and try again.');
    }
    var readJson = response.json.bind(response);
    response.json = async function () {
      var data;
      try { data = await readJson(); }
      catch (_) { throw new Error('The service returned an unexpected response. Please try again.'); }
      if (!response.ok) {
        if (response.status >= 500) data = { message: 'The service is temporarily unavailable. Please try again later.' };
        else if (data && data.message === 'Invalid browser request origin') data = { message: 'Unable to complete this request. Refresh the page and try again.' };
      }
      return data;
    };
    return response;
  }

  async function request(input, options) {
    var response = await publicFetch(input, options);
    var data = await response.json();
    if (!response.ok) throw new Error(data && data.message || 'Unable to complete this request.');
    return data;
  }

  window.SyncVCardPublicApi = { fetch: publicFetch, request: request };
}());
