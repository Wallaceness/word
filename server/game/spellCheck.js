var Trie = require('trie-hard');

var spellCheck = new Trie();


dict.forEach(w=>spellCheck.add(w));

module.exports = spellCheck;
