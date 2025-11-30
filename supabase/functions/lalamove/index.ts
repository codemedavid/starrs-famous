import { serve } from 'https://deno.land/std@0.211.0/http/server.ts';

type DeliveryCoordinates = { lat: number; lng: number };
type DeliveryStoreConfig = {
  market: string;
  serviceType: string;
  sandbox: boolean;
  storeName: string;
  storePhone: string;
  storeAddress: string;
  storeLatitude: number;
  storeLongitude: number;
};

const API_KEY = Deno.env.get('LALAMOVE_API_KEY');
const API_SECRET = Deno.env.get('LALAMOVE_API_SECRET');
if (!API_KEY || !API_SECRET) {
  console.error('Missing Lalamove credentials in environment');
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const quoteBaseUrl = (sandbox: boolean) =>
  sandbox ? 'https://rest.sandbox.lalamove.com/v3' : 'https://rest.lalamove.com/v3';

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const signRequest = async (method: string, path: string, body: string, secret: string) => {
  const timestamp = new Date().toISOString();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const message = `${timestamp}\r\n${method}\r\n${path}\r\n\r\n${body}`;
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return {
    timestamp,
    signature: arrayBufferToBase64(signatureBuffer)
  };
};

const makeLalamoveRequest = async (
  method: string,
  path: string,
  body: Record<string, unknown> | null,
  market: string,
  sandbox: boolean
) => {
  const bodyString = body ? JSON.stringify(body) : '';
  const { signature } = await signRequest(method, path, bodyString, API_SECRET!);
  const response = await fetch(`${quoteBaseUrl(sandbox)}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-LLM-Market': market,
      'Authorization': `hmac ${API_KEY}:${signature}`,
      'X-Request-Id': `srv-${crypto.randomUUID()}`
    },
    body: bodyString || undefined
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Lalamove API request failed');
  }

  return response.json().catch(() => null);
};

const getLanguageForMarket = (market: string) => {
  const map: Record<string, string> = {
    HK: 'en_HK',
    SG: 'en_SG',
    TH: 'th_TH',
    PH: 'en_PH',
    TW: 'zh_TW',
    MY: 'ms_MY',
    VN: 'vi_VN'
  };
  return map[market] || 'en_US';
};

const buildStops = (
  config: DeliveryStoreConfig,
  deliveryAddress: string,
  deliveryCoordinates: DeliveryCoordinates
) => [
  {
    location: {
      lat: config.storeLatitude.toString(),
      lng: config.storeLongitude.toString()
    },
    addresses: {
      [getLanguageForMarket(config.market)]: {
        displayString: config.storeAddress,
        country: config.market
      }
    },
    contactName: config.storeName
  },
  {
    location: {
      lat: deliveryCoordinates.lat.toString(),
      lng: deliveryCoordinates.lng.toString()
    },
    addresses: {
      [getLanguageForMarket(config.market)]: {
        displayString: deliveryAddress,
        country: config.market
      }
    },
    contactName: config.storeName
  }
];

const handleQuote = async (req: Request) => {
  const payload = await req.json();
  const required = [
    'deliveryAddress',
    'deliveryLat',
    'deliveryLng',
    'market',
    'serviceType',
    'sandbox',
    'storeName',
    'storePhone',
    'storeAddress',
    'storeLatitude',
    'storeLongitude'
  ];
  if (required.some((key) => payload[key] === undefined)) {
    return new Response(JSON.stringify({ error: 'Missing quote payload fields' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }

  const config: DeliveryStoreConfig = {
    market: payload.market,
    serviceType: payload.serviceType,
    sandbox: Boolean(payload.sandbox),
    storeName: payload.storeName,
    storePhone: payload.storePhone,
    storeAddress: payload.storeAddress,
    storeLatitude: Number(payload.storeLatitude),
    storeLongitude: Number(payload.storeLongitude)
  };

  const stops = buildStops(config, payload.deliveryAddress, {
    lat: Number(payload.deliveryLat),
    lng: Number(payload.deliveryLng)
  });

  const body = {
    data: {
      serviceType: config.serviceType,
      language: getLanguageForMarket(config.market),
      stops,
      item: {
        quantity: '1',
        weight: '1'
      }
    }
  };

  const data = await makeLalamoveRequest('POST', '/quotations', body, config.market, config.sandbox);
  return new Response(JSON.stringify({
    quotationId: data.quotationId,
    price: data.priceBreakdown?.total,
    currency: data.priceBreakdown?.currency,
    expiresAt: data.expiresAt
  }), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
};

const handleOrder = async (req: Request) => {
  const payload = await req.json();
  const required = ['quotationId', 'recipientName', 'recipientPhone', 'market', 'sandbox', 'storeName', 'storePhone'];
  if (required.some((key) => payload[key] === undefined)) {
    return new Response(JSON.stringify({ error: 'Missing order payload fields' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }

  const config = {
    market: payload.market,
    serviceType: payload.serviceType || 'MOTORCYCLE',
    sandbox: Boolean(payload.sandbox),
    storeName: payload.storeName,
    storePhone: payload.storePhone,
    storeAddress: payload.storeAddress || '',
    storeLatitude: payload.storeLatitude || 0,
    storeLongitude: payload.storeLongitude || 0
  };

  const quotation = await makeLalamoveRequest('GET', `/quotations/${payload.quotationId}`, null, config.market, config.sandbox);
  const senderStopId = quotation.stops?.[0]?.id || '';
  const recipientStopId = quotation.stops?.[1]?.id || '';

  const body = {
    data: {
      quotationId: payload.quotationId,
      sender: {
        stopId: senderStopId,
        name: config.storeName,
        phone: config.storePhone
      },
      recipients: [
        {
          stopId: recipientStopId,
          name: payload.recipientName,
          phone: payload.recipientPhone,
          remarks: ''
        }
      ],
      isPODEnabled: true,
      metadata: payload.metadata || {}
    }
  };

  const order = await makeLalamoveRequest('POST', '/orders', body, config.market, config.sandbox);
  return new Response(JSON.stringify({
    orderId: order.id,
    status: order.status,
    shareLink: order.shareLink,
    driverId: order.driverId
  }), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
};

const handler = async (req: Request) => {
  if (!API_KEY || !API_SECRET) {
    return new Response(JSON.stringify({ error: 'Missing Lalamove credentials' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  if (req.method === 'POST' && url.pathname.endsWith('/quote')) {
    return handleQuote(req);
  }

  if (req.method === 'POST' && url.pathname.endsWith('/order')) {
    return handleOrder(req);
  }

  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
};

serve(handler);
