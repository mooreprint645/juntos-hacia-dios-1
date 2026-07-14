(() => {
  if (window.supabase?.createClient) return;
  console.error("No se pudo cargar la biblioteca de Supabase.");
  window.supabase = {
    createClient() {
      return null;
    }
  };
})();
