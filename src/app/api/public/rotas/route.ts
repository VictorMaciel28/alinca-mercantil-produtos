import { NextResponse } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

type RoutesBody = {
  origin?: { lat: number; lng: number };
  stops?: string[];
  travelMode?: 'DRIVE' | 'WALK' | 'BICYCLE' | 'TWO_WHEELER';
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: 'Google Maps API Key não configurada' }, { status: 500, headers: corsHeaders });
    }

    const body = (await request.json()) as RoutesBody;
    const origin = body?.origin;
    const stops = Array.isArray(body?.stops) ? body.stops.map((s) => String(s || '').trim()).filter(Boolean) : [];
    const travelMode = body?.travelMode || 'DRIVE';

    if (!origin || !Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) {
      return NextResponse.json({ ok: false, error: 'Origem inválida' }, { status: 400, headers: corsHeaders });
    }
    if (stops.length < 1) {
      return NextResponse.json({ ok: false, error: 'Informe ao menos um destino' }, { status: 400, headers: corsHeaders });
    }

    const destination = stops[stops.length - 1];
    const intermediates = stops.slice(0, -1);

    const payload = {
      origin: {
        location: {
          latLng: { latitude: origin.lat, longitude: origin.lng },
        },
      },
      destination: { address: destination },
      intermediates: intermediates.map((address) => ({
        address,
        vehicleStopover: true,
      })),
      travelMode,
    };

    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.polyline.encodedPolyline,routes.distanceMeters,routes.duration',
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.routes?.length) {
      return NextResponse.json(
        { ok: false, error: 'Falha ao gerar rota', detalhe: json || null },
        { status: res.status || 502, headers: corsHeaders }
      );
    }

    const route = json.routes[0];
    return NextResponse.json(
      {
        ok: true,
        polyline: route?.polyline?.encodedPolyline || null,
        distanceMeters: route?.distanceMeters || 0,
        duration: route?.duration || null,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'Erro ao gerar rota' }, { status: 500, headers: corsHeaders });
  }
}
