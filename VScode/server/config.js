const path = require('path');

// Projekta sakne ir mape VScode (viens līmenis virs server/)
const rootDir = path.join(__dirname, '..');

module.exports = {
  distDir: path.join(rootDir, 'dist'),
  seedProductsFile: path.join(rootDir, 'seed', 'products.json')
};
