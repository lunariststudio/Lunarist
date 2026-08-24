const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'index.html');
let html = fs.readFileSync(file, 'utf8');

const oldBlock = "headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ action: 'toggle-member', targetId: id, nextType: next })";
const newBlock = "headers: await apiAuthHeaders(),\n        body: JSON.stringify({ action: 'toggle-member', targetId: id, nextType: next })";

if (html.includes(oldBlock)) {
  html = html.replace(oldBlock, newBlock);
  fs.writeFileSync(file, html, 'utf8');
  console.log('Patched Admin Studio member toggle to send the Supabase access token.');
} else if (html.includes(newBlock)) {
  console.log('Admin Studio member toggle auth is already patched.');
} else {
  throw new Error('Could not find the Admin Studio member toggle request block.');
}
