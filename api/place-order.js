import { createClient } from '@supabase/supabase-js';

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

 
  const supabaseUrl = process.env.SB_URL;
  const supabaseServiceRoleKey = process.env.SB_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return res.status(500).json({ error: 'Error de configuración del servidor. Faltan claves.' });
  }

  try {
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { orderDetails, products: currentProducts } = req.body;

    if (!orderDetails || !orderDetails.items || orderDetails.items.length === 0) {
      return res.status(400).json({ error: 'Datos de la orden inválidos o vacíos.' });
    }

    // 1. Validar y actualizar stock de forma segura
    const updates = orderDetails.items.map(item => {
        const product = currentProducts.find(p => p.id === item.id);

        if (!product) {
            throw new Error(`Producto con ID ${item.id} no encontrado.`);
        }
        
        if (product.stock < item.qty) {
            throw new Error(`No hay suficiente stock para ${product.name}. Stock disponible: ${product.stock}`);
        }

        const newStock = product.stock - item.qty;

        // Actualizar el stock
        return supabase
            .from('products')
            .update({ stock: newStock })
            .eq('id', item.id)
            .select(); 
    });

    const updateResults = await Promise.all(updates);

    for (const result of updateResults) {
        if (result.error) {
            throw new Error('Error al actualizar el stock: ' + result.error.message);
        }
    }

    // 2. Guardar el pedido en la tabla 'orders'
    const orderData = {
        customer_name: orderDetails.name,
        customer_address: orderDetails.address,
        payment_method: orderDetails.payment,
        total_amount: orderDetails.total,
        order_items: orderDetails.items,
        order_status: 'Pendiente'
    };

    const { error: orderError } = await supabase.from('orders').insert([orderData]);

    if (orderError) {
        throw new Error('Error al guardar el pedido: ' + orderError.message);
    }

    res.status(200).json({ success: true, message: 'Orden procesada con éxito.' });

  } catch (error) {
    console.error('Error en la API de orden:', error.message);
    // Si la transacción falla, retornar error 500
    res.status(500).json({ error: error.message });
  }
};
