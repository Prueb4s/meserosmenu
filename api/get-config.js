export default (req, res) => {
  
  const SP_URL = process.env.SP_URL;
  const SP_ANON_KEY = process.env.SP_ANON_KEY;

 
  console.log('--- Diagnóstico API Config ---');
  console.log('URL Cargada:', !!SP_URL); 
  console.log('ANON_KEY Cargada:', !!SP_ANON_KEY);
  console.log('------------------------------');

  if (!SP_URL || !SP_ANON_KEY) {
    
    return res.status(500).json({ 
      error: 'Variables de entorno de SUPA faltantes en la configuración de Vercel.',
      url: null,
      anonKey: null
    });
  }


  res.status(200).json({
    url: SP_URL,
    anonKey: SP_ANON_KEY
  });
};
