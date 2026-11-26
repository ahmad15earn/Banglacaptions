// Run: node tests/test_segment.js  (tests the pure ES3 segmentation code inside the panel)
var fs = require('fs'), path = require('path');
var src = fs.readFileSync(path.join(__dirname, '..', 'panel', 'BanglaCaption.jsx'), 'utf8');
var seg = src.split('// ---SEG-BEGIN---')[1].split('// ---SEG-END---')[0];
eval(seg + ';global.bcBuildBlocks=bcBuildBlocks;global.bcLinesToBlocks=bcLinesToBlocks;');
function W(t, s, e) { return { t: t, s: s, e: e }; }
function assert(c, m) { if (!c) { console.error('FAIL: ' + m); process.exit(1); } }
var words = [W('a1',0,.3),W('a2',.4,.7),W('a3',.8,1),W('a4',1.1,1.4),W('a5',1.5,1.8),W('a6',1.9,2.2),W('a7\u0964',2.3,2.6),
  W('b1',3.5,3.8),W('b2,',3.9,4.2),W('c1',4.3,4.6),W('c2',4.7,5.0),W('d',5.1,5.2),W('e1',6.5,6.8)];
[1,2,3,5,12].forEach(function (n) {
  var b = bcBuildBlocks(words, n, 0.5), joined = [];
  b.forEach(function (x) {
    assert(x.text.split(' ').length <= n, 'block longer than ' + n);
    assert(x.e > x.s, 'non-positive duration');
    joined.push(x.text);
  });
  assert(joined.join(' ') === words.map(function (w) { return w.t; }).join(' '), 'word order/content changed for max ' + n);
  for (var i = 1; i < b.length; i++) assert(b[i].s >= b[i - 1].e - 1e-9, 'overlap for max ' + n);
});
// no lone trailing word when it can be avoided (max 3: a4 a5 / a6 a7)
var b3 = bcBuildBlocks(words, 3, 0.5);
assert(b3[0].text === 'a1 a2 a3', 'balanced split');
// editor: same word count keeps exact word timing even when lines are merged
var m = bcLinesToBlocks(['a1 a2 a3 a4 a5 a6 a7\u0964', 'b1 b2, c1 c2 d e1'], words);
assert(m.exact === true && m.length === 2 && m[0].s === 0 && m[1].s === 3.5, 'exact merge');
// editor: changed word count falls back to estimated timing
var f = bcLinesToBlocks(['x y', 'z'], words);
assert(f.exact === false && f.length === 2 && f[0].s === 0, 'estimated fallback');
assert(bcLinesToBlocks(['', '  '], words).length === 0, 'empty editor');
console.log('segmentation tests passed');
