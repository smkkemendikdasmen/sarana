const bcrypt = require('/Users/ilahilah/Documents/Project/PRISMA/saranasmk/apps/api/node_modules/bcryptjs');
const PWD = 'admin123';
bcrypt.hash(PWD, 10, (err, hash) => {
  if (err) { console.error(err); process.exit(1); }
  console.log(JSON.stringify({ password: PWD, hash: hash }, null, 2));
  process.exit(0);
});
