import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowLeft, Clock, Search, Loader2 } from 'lucide-react';
import { CartItem, PaymentMethod, ServiceType, AddressSuggestion } from '../types';
import { usePaymentMethods } from '../hooks/usePaymentMethods';
import { useOrders } from '../hooks/useOrders';
import { useAddressAutocomplete } from '../hooks/useAddressAutocomplete';
import { useSiteSettings } from '../hooks/useSiteSettings';
import { fetchDeliveryQuotation, buildLalamoveConfig } from '../lib/lalamove';

interface CheckoutProps {
  cartItems: CartItem[];
  totalPrice: number;
  onBack: () => void;
}

const Checkout: React.FC<CheckoutProps> = ({ cartItems, totalPrice, onBack }) => {
  const { paymentMethods } = usePaymentMethods();
  const { createOrder } = useOrders();
  const [step, setStep] = useState<'details' | 'payment'>('details');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType>('dine-in');
  const [address, setAddress] = useState('');
  const [addressQuery, setAddressQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const { suggestions, loading: addressLoading, error: addressError } = useAddressAutocomplete(
    serviceType === 'delivery' ? addressQuery : ''
  );
  const [landmark, setLandmark] = useState('');
  const [pickupTime, setPickupTime] = useState('5-10');
  const [customTime, setCustomTime] = useState('');
  // Dine-in specific state
  const [partySize, setPartySize] = useState(1);
  const [dineInTime, setDineInTime] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('gcash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryCoordinates, setDeliveryCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [deliveryFee, setDeliveryFee] = useState<number | null>(null);
  const [deliveryQuoteId, setDeliveryQuoteId] = useState<string | null>(null);
  const [deliveryFeeCurrency, setDeliveryFeeCurrency] = useState('PHP');
  const [isFetchingDeliveryFee, setIsFetchingDeliveryFee] = useState(false);
  const [deliveryFeeError, setDeliveryFeeError] = useState<string | null>(null);
  const { siteSettings } = useSiteSettings();
  const lalamoveConfig = useMemo(() => buildLalamoveConfig(siteSettings), [siteSettings]);
  const lalamoveEnabled = Boolean(lalamoveConfig);

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  // Set default payment method when payment methods are loaded
  React.useEffect(() => {
    if (paymentMethods.length > 0 && !paymentMethod) {
      setPaymentMethod(paymentMethods[0].id as PaymentMethod);
    }
  }, [paymentMethods, paymentMethod]);

  const selectedPaymentMethod = paymentMethods.find(method => method.id === paymentMethod);
  const deliveryCharge = serviceType === 'delivery' ? (deliveryFee ?? 0) : 0;
  const totalWithDelivery = totalPrice + deliveryCharge;
  const deliveryFeeLabel = isFetchingDeliveryFee
    ? 'Calculating...'
    : deliveryFeeError
      ? 'Unavailable'
      : deliveryFee !== null
        ? `₱${deliveryFee}`
        : 'Pending';

  const handleProceedToPayment = () => {
    setStep('payment');
  };

  const handlePlaceOrder = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Create order in database
      const finalTotal = totalWithDelivery;
      const order = await createOrder(
        cartItems,
        customerName,
        contactNumber,
        serviceType,
        paymentMethod,
        finalTotal,
        {
          address: serviceType === 'delivery' ? address : undefined,
          landmark: serviceType === 'delivery' ? landmark : undefined,
          pickupTime: serviceType === 'pickup' ? (pickupTime === 'custom' ? customTime : `${pickupTime} minutes`) : undefined,
          partySize: serviceType === 'dine-in' ? partySize : undefined,
          dineInTime: serviceType === 'dine-in' ? dineInTime : undefined,
          referenceNumber: referenceNumber || undefined,
          notes: notes || undefined,
          deliveryFee: serviceType === 'delivery' ? deliveryFee ?? undefined : undefined,
          lalamoveQuotationId: serviceType === 'delivery' ? deliveryQuoteId ?? undefined : undefined,
          deliveryLat: serviceType === 'delivery' ? deliveryCoordinates?.lat : undefined,
          deliveryLng: serviceType === 'delivery' ? deliveryCoordinates?.lng : undefined
        }
      );

      // Prepare order details for Messenger
      const timeInfo = serviceType === 'pickup' 
        ? (pickupTime === 'custom' ? customTime : `${pickupTime} minutes`)
        : '';
      
      const dineInInfo = serviceType === 'dine-in' 
        ? `👥 Party Size: ${partySize} person${partySize !== 1 ? 's' : ''}\n🕐 Preferred Time: ${new Date(dineInTime).toLocaleString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
          })}`
        : '';
      
      const orderDetails = `
🛒 Starr's Famous Shakes ORDER
📦 Order Number: ${order.order_number}

👤 Customer: ${customerName}
📞 Contact: ${contactNumber}
📍 Service: ${serviceType.charAt(0).toUpperCase() + serviceType.slice(1)}
 ${serviceType === 'delivery' ? `🏠 Address: ${address}${landmark ? `\n🗺️ Landmark: ${landmark}` : ''}` : ''}
${serviceType === 'pickup' ? `⏰ Pickup Time: ${timeInfo}` : ''}
${serviceType === 'dine-in' ? dineInInfo : ''}


📋 ORDER DETAILS:
${cartItems.map(item => {
  let itemDetails = `• ${item.name}`;
  if (item.selectedVariation) {
    itemDetails += ` (${item.selectedVariation.name})`;
  }
  if (item.selectedAddOns && item.selectedAddOns.length > 0) {
    itemDetails += ` + ${item.selectedAddOns.map(addOn => 
      addOn.quantity && addOn.quantity > 1 
        ? `${addOn.name} x${addOn.quantity}`
        : addOn.name
    ).join(', ')}`;
  }
  itemDetails += ` x${item.quantity} - ₱${item.totalPrice * item.quantity}`;
  return itemDetails;
}).join('\n')}

💰 TOTAL: ₱${totalWithDelivery}
${serviceType === 'delivery' ? `🛵 DELIVERY FEE: ${deliveryFeeLabel}` : ''}

💳 Payment: ${selectedPaymentMethod?.name || paymentMethod}
📸 Payment Screenshot: Please attach your payment receipt screenshot

${notes ? `📝 Notes: ${notes}` : ''}

Please confirm this order to proceed. Thank you for choosing Starr's Famous Shakes! 🥟
      `.trim();

      const encodedMessage = encodeURIComponent(orderDetails);
      const messengerUrl = `https://m.me/StarrsFamousShakes?text=${encodedMessage}`;
      
      // Show success message
      alert(`Order placed successfully!\n\nOrder Number: ${order.order_number}\n\nYou will now be redirected to Messenger to confirm your order.`);
      
      // Open Messenger
      window.open(messengerUrl, '_blank');
      
      // Clear form and go back to menu (you might want to clear cart here)
      // onBack();
      
    } catch (error) {
      console.error('Error placing order:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to place order. Please try again.';
      setSubmitError(errorMessage);
      
      // Check if it's a rate limit error
      if (errorMessage.includes('Rate limit') || errorMessage.includes('wait')) {
        alert(`⚠️ ${errorMessage}\n\nPlease wait before trying again.`);
      } else {
        alert(`❌ ${errorMessage}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle address selection from autocomplete
  const handleAddressSelect = (suggestion: AddressSuggestion) => {
    setAddress(suggestion.display_name);
    setAddressQuery(suggestion.display_name);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    const lat = parseFloat(suggestion.lat);
    const lng = parseFloat(suggestion.lon);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      setDeliveryCoordinates({ lat, lng });
    } else {
      setDeliveryCoordinates(null);
    }
  };

  // Handle address input change
  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAddressQuery(value);
    setAddress(value);
    setShowSuggestions(true);
    setSelectedSuggestionIndex(-1);
    setDeliveryCoordinates(null);
  };

  // Handle keyboard navigation
  const handleAddressKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < suggestions.length) {
          handleAddressSelect(suggestions[selectedSuggestionIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        addressInputRef.current &&
        !addressInputRef.current.contains(event.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update address query when service type changes
  useEffect(() => {
    if (serviceType !== 'delivery') {
      setAddressQuery('');
      setShowSuggestions(false);
      setAddress('');
      setDeliveryCoordinates(null);
      setDeliveryFee(null);
      setDeliveryQuoteId(null);
      setDeliveryFeeError(null);
    }
  }, [serviceType]);

  useEffect(() => {
    if (
      serviceType !== 'delivery' ||
      !address ||
      !deliveryCoordinates ||
      !lalamoveConfig
    ) {
      // Reset when delivery is not active or not fully configured
      setDeliveryFee(null);
      setDeliveryQuoteId(null);
      setDeliveryFeeError(null);
      setIsFetchingDeliveryFee(false);
      setDeliveryFeeCurrency('PHP');
      return;
    }

    let isCancelled = false;
    setIsFetchingDeliveryFee(true);
    setDeliveryFeeError(null);

    const fetchQuote = async () => {
      try {
        const quote = await fetchDeliveryQuotation(address, deliveryCoordinates, lalamoveConfig);
        if (isCancelled) return;
        setDeliveryFee(quote.price);
        setDeliveryQuoteId(quote.quotationId);
        setDeliveryFeeCurrency(quote.currency);
      } catch (error) {
        if (isCancelled) return;
        console.error('Failed to fetch delivery quote:', error);
        setDeliveryFee(null);
        setDeliveryQuoteId(null);
        setDeliveryFeeError(
          error instanceof Error ? error.message : 'Unable to calculate delivery fee'
        );
        setDeliveryFeeCurrency('PHP');
      } finally {
        if (!isCancelled) {
          setIsFetchingDeliveryFee(false);
        }
      }
    };

    fetchQuote();

    return () => {
      isCancelled = true;
    };
  }, [serviceType, address, deliveryCoordinates, lalamoveConfig]);

  const isDetailsValid = customerName && contactNumber && 
    (serviceType !== 'delivery' || (address && (lalamoveConfig ? deliveryFee !== null : true))) && 
    (serviceType !== 'pickup' || (pickupTime !== 'custom' || customTime)) &&
    (serviceType !== 'dine-in' || (partySize > 0 && dineInTime));

  if (step === 'details') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center mb-8">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-gray-600 hover:text-black transition-colors duration-200"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Cart</span>
          </button>
          <h1 className="text-3xl font-noto font-semibold text-black ml-8">Order Details</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order Summary */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-2xl font-noto font-medium text-black mb-6">Order Summary</h2>
            
            <div className="space-y-4 mb-6">
              {cartItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-red-100">
                  <div>
                    <h4 className="font-medium text-black">{item.name}</h4>
                    {item.selectedVariation && (
                      <p className="text-sm text-gray-600">Size: {item.selectedVariation.name}</p>
                    )}
                    {item.selectedAddOns && item.selectedAddOns.length > 0 && (
                      <p className="text-sm text-gray-600">
                        Add-ons: {item.selectedAddOns.map(addOn => addOn.name).join(', ')}
                      </p>
                    )}
                    <p className="text-sm text-gray-600">₱{item.totalPrice} x {item.quantity}</p>
                  </div>
                  <span className="font-semibold text-black">₱{item.totalPrice * item.quantity}</span>
                </div>
              ))}
            </div>
            
            {serviceType === 'delivery' && (
              <div className="flex items-center justify-between text-sm text-gray-600 border-t border-red-200 pt-4">
                <span>Delivery Fee ({deliveryFeeCurrency})</span>
                <span className="font-semibold text-black">{deliveryFeeLabel}</span>
              </div>
            )}
            {serviceType === 'delivery' && deliveryFeeError && (
              <p className="text-xs text-red-600 mt-1">{deliveryFeeError}</p>
            )}
            <div className="border-t border-red-200 pt-4">
              <div className="flex items-center justify-between text-2xl font-noto font-semibold text-black">
                <span>Total:</span>
                <span>₱{totalWithDelivery}</span>
              </div>
            </div>
          </div>

          {/* Customer Details Form */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-2xl font-noto font-medium text-black mb-6">Customer Information</h2>
            
            <form className="space-y-6">
              {/* Customer Information */}
              <div>
                <label className="block text-sm font-medium text-black mb-2">Full Name *</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-4 py-3 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                  placeholder="Enter your full name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-2">Contact Number *</label>
                <input
                  type="tel"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  className="w-full px-4 py-3 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                  placeholder="09XX XXX XXXX"
                  required
                />
              </div>

              {/* Service Type */}
              <div>
                <label className="block text-sm font-medium text-black mb-3">Service Type *</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'dine-in', label: 'Dine In', icon: '🪑' },
                    { value: 'pickup', label: 'Pickup', icon: '🚶' },
                    { value: 'delivery', label: 'Delivery', icon: '🛵' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setServiceType(option.value as ServiceType)}
                      className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                        serviceType === option.value
                          ? 'border-red-600 bg-red-600 text-white'
                          : 'border-red-300 bg-white text-gray-700 hover:border-red-400'
                      }`}
                    >
                      <div className="text-2xl mb-1">{option.icon}</div>
                      <div className="text-sm font-medium">{option.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dine-in Details */}
              {serviceType === 'dine-in' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">Party Size *</label>
                    <div className="flex items-center space-x-4">
                      <button
                        type="button"
                        onClick={() => setPartySize(Math.max(1, partySize - 1))}
                        className="w-10 h-10 rounded-lg border-2 border-red-300 flex items-center justify-center text-red-600 hover:border-red-400 hover:bg-red-50 transition-all duration-200"
                      >
                        -
                      </button>
                      <span className="text-2xl font-semibold text-black min-w-[3rem] text-center">{partySize}</span>
                      <button
                        type="button"
                        onClick={() => setPartySize(Math.min(20, partySize + 1))}
                        className="w-10 h-10 rounded-lg border-2 border-red-300 flex items-center justify-center text-red-600 hover:border-red-400 hover:bg-red-50 transition-all duration-200"
                      >
                        +
                      </button>
                      <span className="text-sm text-gray-600 ml-2">person{partySize !== 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-black mb-2">Preferred Time *</label>
                    <input
                      type="datetime-local"
                      value={dineInTime}
                      onChange={(e) => setDineInTime(e.target.value)}
                      className="w-full px-4 py-3 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Please select your preferred dining time</p>
                  </div>
                </>
              )}

              {/* Pickup Time Selection */}
              {serviceType === 'pickup' && (
                <div>
                  <label className="block text-sm font-medium text-black mb-3">Pickup Time *</label>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: '5-10', label: '5-10 minutes' },
                        { value: '15-20', label: '15-20 minutes' },
                        { value: '25-30', label: '25-30 minutes' },
                        { value: 'custom', label: 'Custom Time' }
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setPickupTime(option.value)}
                          className={`p-3 rounded-lg border-2 transition-all duration-200 text-sm ${
                            pickupTime === option.value
                              ? 'border-red-600 bg-red-600 text-white'
                              : 'border-red-300 bg-white text-gray-700 hover:border-red-400'
                          }`}
                        >
                          <Clock className="h-4 w-4 mx-auto mb-1" />
                          {option.label}
                        </button>
                      ))}
                    </div>
                    
                    {pickupTime === 'custom' && (
                      <input
                        type="text"
                        value={customTime}
                        onChange={(e) => setCustomTime(e.target.value)}
                        className="w-full px-4 py-3 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                        placeholder="e.g., 45 minutes, 1 hour, 2:30 PM"
                        required
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Delivery Address */}
              {serviceType === 'delivery' && (
                <>
                  <div className="relative">
                    <label className="block text-sm font-medium text-black mb-2">Delivery Address *</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                        <Search className="h-5 w-5" />
                      </div>
                      <input
                        ref={addressInputRef}
                        type="text"
                        value={addressQuery}
                        onChange={handleAddressChange}
                        onKeyDown={handleAddressKeyDown}
                        onFocus={() => setShowSuggestions(true)}
                        className="w-full pl-10 pr-10 py-3 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                        placeholder="Search address, village, barangay, or landmark..."
                        required
                      />
                      {addressLoading && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <Loader2 className="h-5 w-5 text-red-600 animate-spin" />
                        </div>
                      )}
                    </div>
                    
                    {/* Autocomplete Suggestions Dropdown */}
                    {showSuggestions && addressQuery.length >= 3 && (
                      <div
                        ref={suggestionsRef}
                        className="absolute z-50 w-full mt-1 bg-white border border-red-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                      >
                        {addressError && (
                          <div className="p-3 text-sm text-red-600 border-b border-red-100">
                            {addressError}
                            <p className="text-xs text-gray-500 mt-1">You can still enter your address manually.</p>
                          </div>
                        )}
                        {!addressError && suggestions.length === 0 && !addressLoading && (
                          <div className="p-3 text-sm text-gray-500 text-center">
                            No addresses found. You can enter your address manually.
                          </div>
                        )}
                        {suggestions.map((suggestion, index) => {
                          // Build detailed address display
                          const primaryLine = (() => {
                            // For exact addresses with house numbers
                            if (suggestion.address.house_number && suggestion.address.road) {
                              return `${suggestion.address.house_number} ${suggestion.address.road}`;
                            }
                            // For landmarks/POIs
                            if (suggestion.address.amenity || suggestion.address.shop || suggestion.address.tourism) {
                              const landmarkName = suggestion.address.amenity || suggestion.address.shop || suggestion.address.tourism;
                              if (landmarkName) {
                                return landmarkName.charAt(0).toUpperCase() + landmarkName.slice(1).replace(/_/g, ' ');
                              }
                            }
                            // For roads without house numbers
                            if (suggestion.address.road) {
                              return suggestion.address.road;
                            }
                            // For villages/barangays
                            if (suggestion.address.barangay || suggestion.address.village) {
                              return suggestion.address.barangay || suggestion.address.village || '';
                            }
                            // Fallback to display name
                            return suggestion.display_name.split(',')[0];
                          })();

                          // Build secondary line with location details
                          const locationParts = [
                            suggestion.address.barangay || suggestion.address.village,
                            suggestion.address.suburb,
                            suggestion.address.neighbourhood,
                            suggestion.address.city || suggestion.address.town || suggestion.address.municipality,
                            suggestion.address.province || suggestion.address.state
                          ].filter(Boolean);

                          const secondaryLine = locationParts.length > 0
                            ? locationParts.join(', ') + (suggestion.address.postcode ? ` ${suggestion.address.postcode}` : '')
                            : suggestion.display_name.split(',').slice(1).join(',').trim();

                          return (
                            <button
                              key={suggestion.place_id}
                              type="button"
                              onClick={() => handleAddressSelect(suggestion)}
                              className={`w-full text-left px-4 py-3 hover:bg-red-50 transition-colors duration-200 border-b border-red-100 last:border-b-0 ${
                                index === selectedSuggestionIndex ? 'bg-red-50' : ''
                              }`}
                            >
                              <div className="font-medium text-black text-sm">
                                {primaryLine}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {secondaryLine}
                              </div>
                              {/* Show type indicator for landmarks */}
                              {(suggestion.address.amenity || suggestion.address.shop || suggestion.address.tourism) && (
                                <div className="text-xs text-red-600 mt-1 font-medium">
                                  📍 Landmark
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {addressQuery.length > 0 && addressQuery.length < 3 && (
                      <p className="text-xs text-gray-500 mt-1">Type at least 3 characters to search</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">Landmark</label>
                    <input
                      type="text"
                      value={landmark}
                      onChange={(e) => setLandmark(e.target.value)}
                      className="w-full px-4 py-3 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                      placeholder="e.g., Near McDonald's, Beside 7-Eleven, In front of school"
                    />
                  </div>
                </>
              )}

              {/* Special Notes */}
              <div>
                <label className="block text-sm font-medium text-black mb-2">Special Instructions</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-3 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                  placeholder="Any special requests or notes..."
                  rows={3}
                />
              </div>

              <button
                onClick={handleProceedToPayment}
                disabled={!isDetailsValid}
                className={`w-full py-4 rounded-xl font-medium text-lg transition-all duration-200 transform ${
                  isDetailsValid
                    ? 'bg-red-600 text-white hover:bg-red-700 hover:scale-[1.02]'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Proceed to Payment
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Payment Step
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center mb-8">
        <button
          onClick={() => setStep('details')}
          className="flex items-center space-x-2 text-gray-600 hover:text-black transition-colors duration-200"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back to Details</span>
        </button>
        <h1 className="text-3xl font-noto font-semibold text-black ml-8">Payment</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Payment Method Selection */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-2xl font-noto font-medium text-black mb-6">Choose Payment Method</h2>
          
          <div className="grid grid-cols-1 gap-4 mb-6">
            {paymentMethods.map((method) => (
              <button
                key={method.id}
                type="button"
                onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                className={`p-4 rounded-lg border-2 transition-all duration-200 flex items-center space-x-3 ${
                  paymentMethod === method.id
                    ? 'border-red-600 bg-red-600 text-white'
                    : 'border-red-300 bg-white text-gray-700 hover:border-red-400'
                }`}
              >
                <span className="text-2xl">💳</span>
                <span className="font-medium">{method.name}</span>
              </button>
            ))}
          </div>

          {/* Payment Details with QR Code */}
          {selectedPaymentMethod && (
            <div className="bg-red-50 rounded-lg p-6 mb-6">
              <h3 className="font-medium text-black mb-4">Payment Details</h3>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm text-gray-600 mb-1">{selectedPaymentMethod.name}</p>
                  <p className="font-mono text-black font-medium">{selectedPaymentMethod.account_number}</p>
                  <p className="text-sm text-gray-600 mb-3">Account Name: {selectedPaymentMethod.account_name}</p>
                  <p className="text-xl font-semibold text-black">Amount: ₱{totalWithDelivery}</p>
                </div>
                <div className="flex-shrink-0">
                  <img 
                    src={selectedPaymentMethod.qr_code_url} 
                    alt={`${selectedPaymentMethod.name} QR Code`}
                    className="w-32 h-32 rounded-lg border-2 border-red-300 shadow-sm"
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.pexels.com/photos/8867482/pexels-photo-8867482.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop';
                    }}
                  />
                  <p className="text-xs text-gray-500 text-center mt-2">Scan to pay</p>
                </div>
              </div>
            </div>
          )}

          {/* Reference Number */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-black mb-2">📸 Payment Proof Required</h4>
            <p className="text-sm text-gray-700">
              After making your payment, please take a screenshot of your payment receipt and attach it when you send your order via Messenger. This helps us verify and process your order quickly.
            </p>
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-2xl font-noto font-medium text-black mb-6">Final Order Summary</h2>
          
          <div className="space-y-4 mb-6">
            <div className="bg-red-50 rounded-lg p-4">
              <h4 className="font-medium text-black mb-2">Customer Details</h4>
              <p className="text-sm text-gray-600">Name: {customerName}</p>
              <p className="text-sm text-gray-600">Contact: {contactNumber}</p>
              <p className="text-sm text-gray-600">Service: {serviceType.charAt(0).toUpperCase() + serviceType.slice(1)}</p>
              {serviceType === 'delivery' && (
                <>
                  <p className="text-sm text-gray-600">Address: {address}</p>
                  {landmark && <p className="text-sm text-gray-600">Landmark: {landmark}</p>}
                </>
              )}
              {serviceType === 'pickup' && (
                <p className="text-sm text-gray-600">
                  Pickup Time: {pickupTime === 'custom' ? customTime : `${pickupTime} minutes`}
                </p>
              )}
              {serviceType === 'dine-in' && (
                <>
                  <p className="text-sm text-gray-600">
                    Party Size: {partySize} person{partySize !== 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-gray-600">
                    Preferred Time: {dineInTime ? new Date(dineInTime).toLocaleString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    }) : 'Not selected'}
                  </p>
                </>
              )}
            </div>

            {cartItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b border-red-100">
                <div>
                  <h4 className="font-medium text-black">{item.name}</h4>
                  {item.selectedVariation && (
                    <p className="text-sm text-gray-600">Size: {item.selectedVariation.name}</p>
                  )}
                  {item.selectedAddOns && item.selectedAddOns.length > 0 && (
                    <p className="text-sm text-gray-600">
                      Add-ons: {item.selectedAddOns.map(addOn => 
                        addOn.quantity && addOn.quantity > 1 
                          ? `${addOn.name} x${addOn.quantity}`
                          : addOn.name
                      ).join(', ')}
                    </p>
                  )}
                  <p className="text-sm text-gray-600">₱{item.totalPrice} x {item.quantity}</p>
                </div>
                <span className="font-semibold text-black">₱{item.totalPrice * item.quantity}</span>
              </div>
            ))}
          </div>
          
          {serviceType === 'delivery' && (
            <div className="flex items-center justify-between text-sm text-gray-600 border-b border-red-100 pb-2 mb-2">
              <span>Delivery Fee ({deliveryFeeCurrency})</span>
              <span className="font-semibold text-black">{deliveryFeeLabel}</span>
            </div>
          )}
          {serviceType === 'delivery' && deliveryFeeError && (
            <p className="text-xs text-red-600 mb-3">{deliveryFeeError}</p>
          )}
          <div className="border-t border-red-200 pt-4 mb-6">
            <div className="flex items-center justify-between text-2xl font-noto font-semibold text-black">
              <span>Total:</span>
              <span>₱{totalWithDelivery}</span>
            </div>
          </div>

          {submitError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{submitError}</p>
            </div>
          )}
          
          <button
            onClick={handlePlaceOrder}
            disabled={isSubmitting}
            className={`w-full py-4 rounded-xl font-medium text-lg transition-all duration-200 transform ${
              isSubmitting
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700 hover:scale-[1.02]'
            }`}
          >
            {isSubmitting ? 'Placing Order...' : 'Place Order via Messenger'}
          </button>
          
          <p className="text-xs text-gray-500 text-center mt-3">
            You'll be redirected to Facebook Messenger to confirm your order. Don't forget to attach your payment screenshot!
          </p>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
