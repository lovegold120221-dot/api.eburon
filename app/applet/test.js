fetch("http://localhost:3000/api/whatsapp/connect", {
  method: "POST",
  headers: { "Authorization": "Bearer test" }
}).then(r => r.json()).then(console.log).catch(console.error);
