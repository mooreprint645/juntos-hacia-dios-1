const SUPABASE_URL = "https://bmtgfbtoyxwrrnygsqcj.supabase.co";

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtdGdmYnRveXh3cnJueWdzcWNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MjQwMTQsImV4cCI6MjA5ODAwMDAxNH0.7RF-h7yqT6gn-rQvtTDOVtxqn_vlVYlwAIusb1wPuLA";

var supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

window.supabaseClient = supabaseClient;
