import type { VercelRequest, VercelResponse } from '@vercel/node';

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

const API_BASE_URL = 'https://rest.lalamove.com/v3';
const API_SANDBOX_URL = 'https://rest.sandbox.lalamove.com/v3';

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing env var ${key}`);
  }
  return value;
};

const signPayload = async (method: string, path: string, body: string, secret: string) => {
  const timestamp = new Date().toISOString();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const message = `${timestamp}\r\n${method}\r\n${path}\r\n\r\n${body}`;
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const signature = Buffer.from(signatureBuffer).toString('base64');
  return { timestamp, signature };
};

const proxyRequest = async (
  req: VercelRequest,
  res: VercelResponse,
  path: string,
  payload: Record<string, unknown>,
  market: string,
  sandbox: boolean
) => {
  const secret = getEnv('LALAMOVE_API_SECRET');
  const apiKey = getEnv('LALAMOVE_API_KEY');
  const { signature } = await signPayload('POST', path, JSON.stringify(payload), secret);
  const upstreamUrl = `${sandbox ? API_SANDBOX_URL : API_BASE_URL}${path}`;

  const upstreamResponse = await fetch(upstreamUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-LLM-Market': market,
      Authorization: `hmac ${apiKey}:${signature}`,
      'X-Request-Id': `vercel-${crypto.randomUUID()}`
    },
    body: JSON.stringify(payload)
  });

  const responseBody = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    res.status(upstreamResponse.status).json({ error: responseBody });
    return null;
  }

  res.status(200).setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  const json = JSON.parse(responseBody);
  return json;
};

const createStops = (
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
      en_PH: {
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
      en_PH: {
        displayString: deliveryAddress,
        country: config.market
      }
    },
    contactName: config.storeName
  }
];

const corsHeaders = (response: VercelResponse) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const body = req.body;
  if (!body || !body.deliveryAddress) {
    return res.status(400).json({ error: 'Missing deliveryAddress' });
  }

  const config: DeliveryStoreConfig = {
    market: body.market,
    serviceType: body.serviceType,
    sandbox: Boolean(body.sandbox),
    storeName: body.storeName,
    storePhone: body.storePhone,
    storeAddress: body.storeAddress,
    storeLatitude: Number(body.storeLatitude),
    storeLongitude: Number(body.storeLongitude)
  };

  if (typeof body.quote !== 'undefined') {
    const quotePayload = {
      data: {
        serviceType: config.serviceType,
        language: 'en_PH',
        stops: createStops(config, body.deliveryAddress, {
          lat: Number(body.deliveryLat),
          lng: Number(body.deliveryLng)
        }),
        item: {
          quantity: '1',
          weight: 'LESS_THAN_3_KG',
          categories: ['FOOD_DELIVERY'],
          handlingInstructions: ['KEEP_UPRIGHT']
        }
      }
    };

    const response = await proxyRequest(req, res, '/quotations', quotePayload, config.market, config.sandbox);
    if (response) {
      return res.json({
        quotationId: response.data?.quotationId,
        price: response.data?.priceBreakdown?.total,
        currency: response.data?.priceBreakdown?.currency,
        expiresAt: response.data?.expiresAt
      });
    }
    return null;
  }

  if (!body.quotationId || !body.recipientName || !body.recipientPhone) {
    return res.status(400).json({ error: 'Missing order fields' });
  }

  const orderPayload = {
    data: {
      quotationId: body.quotationId,
      sender: {
        stopId: body.stopIdSender,
        name: config.storeName,
        phone: config.storePhone
      },
      recipients: [
        {
          stopId: body.stopIdRecipient,
          name: body.recipientName,
          phone: body.recipientPhone,
          remarks: ''
        }
      ],
      isPODEnabled: true,
      metadata: body.metadata || {}
    }
  };

  const response = await proxyRequest(req, res, '/orders', orderPayload, config.market, config.sandbox);
  if (response) {
    return res.json({
      orderId: response.data?.orderId,
      status: response.data?.status,
      shareLink: response.data?.shareLink,
      driverId: response.data?.driverId
    });
  }

  return null;
}
