import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Order, OrderFilters, OrderStats, OrderStatus, CartItem } from '../types';
import { getClientIP, checkRateLimit, recordAction } from '../lib/rateLimit';
import { createDeliveryOrder, buildLalamoveConfig } from '../lib/lalamove';
import type { DeliveryOrderResult } from '../lib/lalamove';
import { useSiteSettings } from './useSiteSettings';

interface CreateOrderOptions {
  address?: string;
  landmark?: string;
  pickupTime?: string;
  partySize?: number;
  dineInTime?: string;
  referenceNumber?: string;
  notes?: string;
  deliveryFee?: number;
  lalamoveQuotationId?: string;
  deliveryLat?: number;
  deliveryLng?: number;
}
import type { RealtimeChannel } from '@supabase/supabase-js';

export const useOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const currentFiltersRef = useRef<OrderFilters | undefined>(undefined);
  const { siteSettings } = useSiteSettings();
  const lalamoveConfig = useMemo(() => buildLalamoveConfig(siteSettings), [siteSettings]);

  const normalizePhoneNumber = (phone?: string): string | undefined => {
    if (!phone) return undefined;
    const trimmed = phone.trim();
    if (!trimmed) return undefined;
    if (trimmed.startsWith('+')) return trimmed;
    const digits = trimmed.replace(/\D/g, '');
    if (!digits) return undefined;
    const isPH = digits.startsWith('63') || digits.startsWith('0') || digits.startsWith('9');
    if (isPH) {
      if (digits.startsWith('63')) return `+${digits}`;
      if (digits.startsWith('0')) return `+63${digits.slice(1)}`;
      return `+63${digits}`;
    }
    return `+${digits}`;
  };

  // Format order data helper
  const formatOrderData = (order: any): Order => ({
    id: order.id,
    order_number: order.order_number,
    customer_name: order.customer_name,
    contact_number: order.contact_number,
    service_type: order.service_type,
    address: order.address,
    landmark: order.landmark,
    pickup_time: order.pickup_time,
    party_size: order.party_size,
    dine_in_time: order.dine_in_time,
    payment_method: order.payment_method,
    reference_number: order.reference_number,
    status: order.status,
    total: order.total,
    notes: order.notes,
    customer_ip: order.customer_ip,
    created_at: order.created_at,
    updated_at: order.updated_at,
    completed_at: order.completed_at,
    delivery_fee: order.delivery_fee ? Number(order.delivery_fee) : null,
    lalamove_quotation_id: order.lalamove_quotation_id,
    lalamove_order_id: order.lalamove_order_id,
    lalamove_status: order.lalamove_status,
    lalamove_tracking_url: order.lalamove_tracking_url,
    order_items: order.order_items?.map((item: any) => ({
      id: item.id,
      order_id: item.order_id,
      menu_item_id: item.menu_item_id,
      menu_item_name: item.menu_item_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
      selected_variation: item.selected_variation,
      selected_add_ons: item.selected_add_ons,
      created_at: item.created_at
    })) || []
  });

  const fetchOrders = async (filters?: OrderFilters) => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (*)
        `)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      
      if (filters?.service_type) {
        query = query.eq('service_type', filters.service_type);
      }
      
      if (filters?.date_from) {
        query = query.gte('created_at', filters.date_from);
      }
      
      if (filters?.date_to) {
        query = query.lte('created_at', filters.date_to);
      }
      
      if (filters?.search) {
        const searchTerm = filters.search.toLowerCase();
        query = query.or(`order_number.ilike.%${searchTerm}%,customer_name.ilike.%${searchTerm}%,contact_number.ilike.%${searchTerm}%`);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      const formattedOrders: Order[] = (data || []).map(order => formatOrderData(order));

      setOrders(formattedOrders);
      setError(null);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderById = async (id: string): Promise<Order | null> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (*)
        `)
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      if (!data) return null;

      return formatOrderData(data);
    } catch (err) {
      console.error('Error fetching order:', err);
      throw err;
    }
  };

  const createOrder = async (
    cartItems: CartItem[],
    customerName: string,
    contactNumber: string,
    serviceType: 'dine-in' | 'pickup' | 'delivery',
    paymentMethod: string,
    total: number,
    options?: CreateOrderOptions
  ): Promise<Order> => {
    try {
      // Check rate limit (frontend check)
      const clientIP = getClientIP();
      const rateLimitCheck = checkRateLimit(clientIP, 'order_placement', 30);
      
      if (!rateLimitCheck.allowed) {
        throw new Error(`Rate limit exceeded. ${rateLimitCheck.cooldownRemaining ? `Please wait ${rateLimitCheck.cooldownRemaining} seconds.` : 'Please try again later.'}`);
      }

      // Check backend rate limit
      // Note: The actual IP will be captured by the backend from the request
      // For now, we'll rely on frontend rate limiting and backend RLS policies
      // The backend function will be called server-side if needed

      // Generate order number
      const { data: orderNumberData, error: orderNumberError } = await supabase.rpc('generate_order_number');
      
      if (orderNumberError) throw orderNumberError;
      if (!orderNumberData) throw new Error('Failed to generate order number');

      const orderNumber = orderNumberData;

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          customer_name: customerName,
          contact_number: contactNumber,
          service_type: serviceType,
          address: options?.address || null,
          landmark: options?.landmark || null,
          pickup_time: options?.pickupTime || null,
          party_size: options?.partySize || null,
          dine_in_time: options?.dineInTime || null,
          payment_method: paymentMethod,
          reference_number: options?.referenceNumber || null,
          status: 'pending',
          total: total,
          delivery_fee: options?.deliveryFee ?? null,
          lalamove_quotation_id: options?.lalamoveQuotationId || null,
          lalamove_order_id: null,
          lalamove_status: null,
          lalamove_tracking_url: null,
          notes: options?.notes || null,
          customer_ip: clientIP
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      // Extract the original menu item ID from the cart item ID
      // Cart item IDs are formatted as: ${menuItemId}-${variationId}-${addOnIds}
      // We need to extract just the menu item UUID (first 36 characters: 8-4-4-4-12 format)
      const orderItems = cartItems.map(item => {
        // Extract the original menu item ID (UUID format: 8-4-4-4-12 = 36 chars)
        // The cart item ID format is: menuItemId-variationId-addOnIds
        // Example: "41d67da1-f4ba-4b92-bfee-429d1be59e3f-265399d1-1d57-4376-8386-5cbf7340fd80-none"
        // We need the first UUID: "41d67da1-f4ba-4b92-bfee-429d1be59e3f"
        let menuItemId: string | null = null;
        if (item.id) {
          // Find the first UUID in the string (36 characters: 8-4-4-4-12)
          const uuidMatch = item.id.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
          if (uuidMatch && uuidMatch[1]) {
            menuItemId = uuidMatch[1];
          }
        }
        
        return {
          order_id: order.id,
          menu_item_id: menuItemId,
          menu_item_name: item.name,
          quantity: item.quantity,
          unit_price: item.totalPrice,
          total_price: item.totalPrice * item.quantity,
          selected_variation: item.selectedVariation || null,
          selected_add_ons: item.selectedAddOns || null
        };
      });

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      let lalamoveOrderResult: DeliveryOrderResult | null = null;
      if (
        serviceType === 'delivery' &&
        options?.lalamoveQuotationId &&
        lalamoveConfig
      ) {
        try {
          const normalizedRecipientPhone = normalizePhoneNumber(contactNumber) || contactNumber;
          lalamoveOrderResult = await createDeliveryOrder(
            options.lalamoveQuotationId,
            customerName,
            normalizedRecipientPhone,
            lalamoveConfig,
            {
              orderId: order.id,
              deliveryAddress: options?.address,
              deliveryLat: options?.deliveryLat,
              deliveryLng: options?.deliveryLng,
            }
          );
        } catch (orderError) {
          console.error('Failed to create Lalamove order:', orderError);
        }
      }

      if (lalamoveOrderResult) {
        const { error: lalamoveUpdateError } = await supabase
          .from('orders')
          .update({
            lalamove_order_id: lalamoveOrderResult.orderId,
            lalamove_status: lalamoveOrderResult.status,
            lalamove_tracking_url: lalamoveOrderResult.shareLink,
          })
          .eq('id', order.id);

        if (lalamoveUpdateError) {
          console.error('Failed to save Lalamove order info:', lalamoveUpdateError);
        }
      }

      // Record action for rate limiting
      recordAction(clientIP, 'order_placement', 30);

      // Fetch the complete order
      const completeOrder = await fetchOrderById(order.id);
      if (!completeOrder) throw new Error('Failed to fetch created order');

      // Refresh orders list
      await fetchOrders();

      return completeOrder;
    } catch (err) {
      console.error('Error creating order:', err);
      throw err;
    }
  };

  const updateOrderStatus = async (id: string, status: OrderStatus): Promise<void> => {
    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id);

      if (updateError) throw updateError;

      await fetchOrders();
    } catch (err) {
      console.error('Error updating order status:', err);
      throw err;
    }
  };

  const bulkUpdateStatus = async (ids: string[], status: OrderStatus): Promise<void> => {
    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status })
        .in('id', ids);

      if (updateError) throw updateError;

      // Refresh orders list
      await fetchOrders();
    } catch (err) {
      console.error('Error bulk updating order status:', err);
      throw err;
    }
  };

  const getOrderStats = async (): Promise<OrderStats> => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = today.toISOString();
      const todayEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString();

      // Get total orders
      const { count: totalOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });

      // Get pending orders
      const { count: pendingOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Get today's orders
      const { count: todayOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart)
        .lt('created_at', todayEnd);

      // Get today's revenue (only from completed orders)
      const { data: todayOrdersData } = await supabase
        .from('orders')
        .select('total')
        .gte('created_at', todayStart)
        .lt('created_at', todayEnd)
        .eq('status', 'completed');

      const todayRevenue = todayOrdersData?.reduce((sum, order) => sum + Number(order.total), 0) || 0;

      // Get completed orders
      const { count: completedOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');

      // Get cancelled orders
      const { count: cancelledOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'cancelled');

      return {
        total_orders: totalOrders || 0,
        pending_orders: pendingOrders || 0,
        today_orders: todayOrders || 0,
        today_revenue: todayRevenue,
        completed_orders: completedOrders || 0,
        cancelled_orders: cancelledOrders || 0
      };
    } catch (err) {
      console.error('Error fetching order stats:', err);
      throw err;
    }
  };

  // Set up real-time subscription
  useEffect(() => {
    // Initial fetch
    fetchOrders();

    // Set up real-time subscription
    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        async (payload) => {
          console.log('Order change received:', payload.eventType, payload.new);
          
          // Refetch orders to get updated data with order_items
          // This ensures we always have the latest data with relationships
          if (currentFiltersRef.current) {
            await fetchOrders(currentFiltersRef.current);
          } else {
            await fetchOrders();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items'
        },
        async (payload) => {
          console.log('Order item change received:', payload.eventType);
          
          // Refetch orders when order items change
          if (currentFiltersRef.current) {
            await fetchOrders(currentFiltersRef.current);
          } else {
            await fetchOrders();
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    channelRef.current = channel;

    // Cleanup subscription on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  // Update fetchOrders to store current filters
  const fetchOrdersWithFilters = async (filters?: OrderFilters) => {
    currentFiltersRef.current = filters;
    await fetchOrders(filters);
  };

  return {
    orders,
    loading,
    error,
    fetchOrders: fetchOrdersWithFilters,
    fetchOrderById,
    createOrder,
    updateOrderStatus,
    bulkUpdateStatus,
    getOrderStats,
    refetch: () => fetchOrdersWithFilters(currentFiltersRef.current)
  };
};
