async function validateTransactionUser(client, userId) {
  const result = await client.query(
    `SELECT u.id FROM users u LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1 AND COALESCE(r.name, 'user') <> 'super_admin'`,
    [userId]
  );
  return Boolean(result.rowCount);
}


module.exports = { validateTransactionUser };
