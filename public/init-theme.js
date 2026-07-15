/* Pre-hydration preference bootstrap. Runs blocking in <head> before first
 * paint. Theme keys must match components/site/ThemeToggle.tsx; the tweak key
 * and motion values must match components/dev/TweakBridge.tsx. */
(function () {
  try {
    var k = 'abhishek.portfolio.mode';
    var v = localStorage.getItem(k);
    if (v !== 'light' && v !== 'dark') {
      v = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-mode', v);
  } catch (e) {}

  try {
    var tweaks = JSON.parse(localStorage.getItem('dl-tweaks-v1') || '{}');
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var motion = reduce ? 'off' : tweaks.motion;
    if (motion === 'on' || motion === 'off') {
      document.documentElement.setAttribute('data-motion', motion);
    }
  } catch (e) {}
})();
