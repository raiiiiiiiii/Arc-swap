import { NextResponse } from 'next/server';

// Force dynamic rendering — this route uses request.url (searchParams)
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');
    const topic0 = searchParams.get('topic0');
    
    if (!address || !topic0) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const url = `https://testnet.arcscan.app/api?module=logs&action=getLogs&address=${address}&fromBlock=0&toBlock=latest&topic0=${topic0}`;
    
    // We add a cache header to avoid hammering the block explorer too often
    const response = await fetch(url, { next: { revalidate: 15 } });
    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Logs API proxy error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
