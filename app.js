(async () => {
  const files = ['js/part1.js','js/part2.js','js/part3.js','js/part4.js','js/part5.js'];
  for (const src of files) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  const { data } = await client.auth.getSession();
  await applySession(data.session);
  client.auth.onAuthStateChange((_event, session) => applySession(session));
})().catch((error) => {
  console.error(error);
  document.body.innerHTML = '<main style="padding:30px;font-family:sans-serif">Não foi possível iniciar o sistema.</main>';
});
