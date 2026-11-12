(function () {
  if (document.getElementById('kc-app')) return;
  try {
    var url = new URL(location.href);
    if (url.searchParams.has('kcv')) return;
    url.searchParams.set('kcv', String(Date.now()));
    location.replace(url.toString());
  } catch (e) {
    location.reload();
  }
})();
