export default (req, res) => {
  
  const SUPA_URL = process.env.SUPA_URL;
  const SUPA_ANON_KEY = process.env.SUPA_ANON_KEY;

 
  console.log('--- Diagnóstico API Config ---');
  console.log('URL Cargada:', !!SUPA_URL); 
  console.log('ANON_KEY Cargada:', !!SUPA_ANON_KEY);
  console.log('------------------------------');

  if (!SUPA_URL || !SUPA_ANON_KEY) {
    
    return res.status(500).json({ 
      error: 'Variables de entorno de SUPA faltantes en la configuración de Vercel.',
      url: null,
      anonKey: null
    });
  }


  res.status(200).json({
    url: SUPA_URL,
    anonKey: SUPA_ANON_KEY
  });
};
