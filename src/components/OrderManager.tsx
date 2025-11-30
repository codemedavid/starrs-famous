import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, Filter, Edit, CheckCircle, XCircle, Clock, Package, Truck, CheckSquare, Square, Download } from 'lucide-react';
import { useOrders } from '../hooks/useOrders';
import { Order, OrderStatus, OrderFilters } from '../types';

interface OrderManagerProps {
  onBack: () => void;
}

const OrderManager: React.FC<OrderManagerProps> = ({ onBack }) => {
  const { orders, loading, fetchOrders, updateOrderStatus, bulkUpdateStatus, getOrderStats } = useOrders();
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [filters, setFilters] = useState<OrderFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [serviceTypeFilter, setServiceTypeFilter] = useState<'all' | 'dine-in' | 'pickup' | 'delivery'>('all');
  const [stats, setStats] = useState({
    total_orders: 0,
    pending_orders: 0,
    today_orders: 0,
    today_revenue: 0,
    completed_orders: 0,
    cancelled_orders: 0
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isRealTimeActive, setIsRealTimeActive] = useState(true);

  useEffect(() => {
    loadStats();
    applyFilters();
    
    // Refresh stats periodically when real-time is active
    const statsInterval = setInterval(() => {
      if (isRealTimeActive) {
        loadStats();
      }
    }, 10000); // Refresh stats every 10 seconds
    
    return () => clearInterval(statsInterval);
  }, [isRealTimeActive]);

  useEffect(() => {
    applyFilters();
  }, [dateFilter, statusFilter, serviceTypeFilter, searchTerm]);

  const loadStats = async () => {
    try {
      const orderStats = await getOrderStats();
      setStats(orderStats);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const applyFilters = async () => {
    const newFilters: OrderFilters = {};

    if (statusFilter !== 'all') {
      newFilters.status = statusFilter;
    }

    if (serviceTypeFilter !== 'all') {
      newFilters.service_type = serviceTypeFilter;
    }

    if (searchTerm) {
      newFilters.search = searchTerm;
    }

    // Date filters
    const now = new Date();
    if (dateFilter === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      newFilters.date_from = today.toISOString();
      newFilters.date_to = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString();
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      newFilters.date_from = weekAgo.toISOString();
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      newFilters.date_from = monthAgo.toISOString();
    }

    setFilters(newFilters);
    await fetchOrders(newFilters);
    await loadStats();
  };

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    try {
      setIsProcessing(true);
      await updateOrderStatus(orderId, newStatus);
      setSelectedOrders([]);
      await loadStats();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update order status');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkStatusChange = async (newStatus: OrderStatus) => {
    if (selectedOrders.length === 0) {
      alert('Please select orders to update');
      return;
    }

    if (confirm(`Are you sure you want to update ${selectedOrders.length} order(s) to "${newStatus}"?`)) {
      try {
        setIsProcessing(true);
        await bulkUpdateStatus(selectedOrders, newStatus);
        setSelectedOrders([]);
        await loadStats();
        alert(`Successfully updated ${selectedOrders.length} order(s)`);
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Failed to update orders');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrders(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const handleSelectAll = () => {
    if (selectedOrders.length === orders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(orders.map(order => order.id));
    }
  };

  const getStatusColor = (status: OrderStatus): string => {
    const colors: Record<OrderStatus, string> = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
      preparing: 'bg-orange-100 text-orange-800 border-orange-200',
      ready: 'bg-green-100 text-green-800 border-green-200',
      out_for_delivery: 'bg-purple-100 text-purple-800 border-purple-200',
      completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const statusOptions: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled'];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="flex items-center space-x-2 text-gray-600 hover:text-black transition-colors duration-200"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Dashboard</span>
              </button>
              <h1 className="text-2xl font-playfair font-semibold text-black">Order Management</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Real-time Status Indicator */}
        <div className="mb-4 flex items-center justify-end">
          <div className="flex items-center space-x-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <div className={`h-2 w-2 rounded-full ${isRealTimeActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
            <span className="text-sm text-green-700 font-medium">
              {isRealTimeActive ? 'Live Updates Active' : 'Real-time Disabled'}
            </span>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Orders</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.total_orders}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-600 rounded-lg">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.pending_orders}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-600 rounded-lg">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Today's Orders</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.today_orders}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-emerald-600 rounded-lg">
                <Truck className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Today's Revenue</p>
                <p className="text-2xl font-semibold text-gray-900">₱{stats.today_revenue.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Order #, Name, Contact..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'all')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="all">All Statuses</option>
                {statusOptions.map(status => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Service Type</label>
              <select
                value={serviceTypeFilter}
                onChange={(e) => setServiceTypeFilter(e.target.value as 'all' | 'dine-in' | 'pickup' | 'delivery')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="dine-in">Dine In</option>
                <option value="pickup">Pickup</option>
                <option value="delivery">Delivery</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as 'all' | 'today' | 'week' | 'month')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedOrders.length > 0 && (
          <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-black mb-1">Bulk Actions</h3>
                <p className="text-sm text-gray-600">{selectedOrders.length} order(s) selected</p>
              </div>
              <div className="flex items-center space-x-3">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBulkStatusChange(e.target.value as OrderStatus);
                      e.target.value = '';
                    }
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isProcessing}
                >
                  <option value="">Change Status...</option>
                  {statusOptions.map(status => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setSelectedOrders([])}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Orders List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
              <p className="text-gray-600">Loading orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No orders found</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-900">
                        <button
                          onClick={handleSelectAll}
                          className="flex items-center space-x-2"
                        >
                          {selectedOrders.length === orders.length ? (
                            <CheckSquare className="h-5 w-5 text-green-600" />
                          ) : (
                            <Square className="h-5 w-5 text-gray-400" />
                          )}
                        </button>
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-900">Order #</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-900">Customer</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-900">Service</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-900">Total</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-900">Status</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-900">Date</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <button onClick={() => handleSelectOrder(order.id)}>
                            {selectedOrders.includes(order.id) ? (
                              <CheckSquare className="h-5 w-5 text-green-600" />
                            ) : (
                              <Square className="h-5 w-5 text-gray-400" />
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{order.order_number}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-medium text-gray-900">{order.customer_name}</div>
                            <div className="text-sm text-gray-500">{order.contact_number}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 capitalize">
                          {order.service_type.replace('-', ' ')}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          ₱{order.total.toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={order.status}
                            onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                            disabled={isProcessing}
                            className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)} focus:ring-2 focus:ring-green-500`}
                          >
                            {statusOptions.map(status => (
                              <option key={status} value={status}>
                                {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {formatDate(order.created_at)}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden">
                {orders.map((order) => (
                  <div key={order.id} className="p-4 border-b border-gray-200">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <button onClick={() => handleSelectOrder(order.id)}>
                          {selectedOrders.includes(order.id) ? (
                            <CheckSquare className="h-5 w-5 text-green-600" />
                          ) : (
                            <Square className="h-5 w-5 text-gray-400" />
                          )}
                        </button>
                        <div>
                          <div className="font-medium text-gray-900">{order.order_number}</div>
                          <div className="text-sm text-gray-500">{order.customer_name}</div>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1).replace('_', ' ')}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div>
                        <span className="text-gray-500">Service:</span>
                        <span className="ml-1 text-gray-900 capitalize">{order.service_type.replace('-', ' ')}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Total:</span>
                        <span className="ml-1 font-medium text-gray-900">₱{order.total.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Date:</span>
                        <span className="ml-1 text-gray-900">{formatDate(order.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                        disabled={isProcessing}
                        className={`flex-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}
                      >
                        {statusOptions.map(status => (
                          <option key={status} value={status}>
                            {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-playfair font-semibold text-black">Order Details</h2>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Order Number</h3>
                <p className="text-lg font-semibold text-black">{selectedOrder.order_number}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Customer</h3>
                  <p className="text-black">{selectedOrder.customer_name}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Contact</h3>
                  <p className="text-black">{selectedOrder.contact_number}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Service Type</h3>
                  <p className="text-black capitalize">{selectedOrder.service_type.replace('-', ' ')}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Payment Method</h3>
                  <p className="text-black">{selectedOrder.payment_method}</p>
                </div>
              </div>
              {selectedOrder.address && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Address</h3>
                  <p className="text-black">{selectedOrder.address}</p>
                  {selectedOrder.landmark && (
                    <p className="text-sm text-gray-600 mt-1">Landmark: {selectedOrder.landmark}</p>
                  )}
                </div>
              )}
              {selectedOrder.pickup_time && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Pickup Time</h3>
                  <p className="text-black">{selectedOrder.pickup_time}</p>
                </div>
              )}
              {selectedOrder.party_size && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Party Size</h3>
                  <p className="text-black">{selectedOrder.party_size} person(s)</p>
                </div>
              )}
              {selectedOrder.dine_in_time && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Preferred Time</h3>
                  <p className="text-black">{formatDate(selectedOrder.dine_in_time)}</p>
                </div>
              )}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Order Items</h3>
                <div className="space-y-2">
                  {selectedOrder.order_items?.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-black">{item.menu_item_name}</p>
                        {item.selected_variation && (
                          <p className="text-sm text-gray-600">Variation: {item.selected_variation.name}</p>
                        )}
                        {item.selected_add_ons && item.selected_add_ons.length > 0 && (
                          <p className="text-sm text-gray-600">
                            Add-ons: {item.selected_add_ons.map(a => a.name).join(', ')}
                          </p>
                        )}
                        <p className="text-sm text-gray-500">Qty: {item.quantity} × ₱{item.unit_price}</p>
                      </div>
                      <p className="font-semibold text-black">₱{item.total_price.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-black">Total</span>
                  <span className="text-2xl font-bold text-black">₱{selectedOrder.total.toLocaleString()}</span>
                </div>
              </div>
              {selectedOrder.notes && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Notes</h3>
                  <p className="text-black">{selectedOrder.notes}</p>
                </div>
              )}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Status</h3>
                  <select
                    value={selectedOrder.status}
                    onChange={(e) => {
                      handleStatusChange(selectedOrder.id, e.target.value as OrderStatus);
                      setSelectedOrder({ ...selectedOrder, status: e.target.value as OrderStatus });
                    }}
                    disabled={isProcessing}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border ${getStatusColor(selectedOrder.status)} focus:ring-2 focus:ring-green-500`}
                  >
                    {statusOptions.map(status => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-sm text-gray-500">
                  Created: {formatDate(selectedOrder.created_at)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderManager;

