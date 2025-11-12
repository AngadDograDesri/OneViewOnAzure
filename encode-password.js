// Helper script to encode password for DATABASE_URL
// Usage: node encode-password.js "your-password-here"

const password = process.argv[2];

if (!password) {
  console.log('Usage: node encode-password.js "your-password-here"');
  process.exit(1);
}

const encoded = encodeURIComponent(password);

console.log('\n===========================================');
console.log('Original password:', password);
console.log('Encoded password:', encoded);
console.log('===========================================');
console.log('\nUse the ENCODED version in your DATABASE_URL');
console.log('Example:');
console.log(`DATABASE_URL="postgresql://user:${encoded}@localhost:5432/mydb"`);
console.log('===========================================\n');








