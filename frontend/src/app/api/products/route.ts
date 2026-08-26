import { NextRequest, NextResponse } from 'next/server';
import { search_products_with_filters } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const category = searchParams.get('category') || undefined;
    const subcategory = searchParams.get('subcategory') || undefined;
    const searchQuery = searchParams.get('search') || searchParams.get('q') || undefined;
    const minPrice = searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined;
    const maxPrice = searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined;
    const inStockOnly = searchParams.get('inStock') === 'true' || searchParams.get('inStockOnly') === 'true';
    const sortBy = (searchParams.get('sortBy') as 'id' | 'price-asc' | 'price-desc' | 'name' | 'stock') || 'id';

    const products = search_products_with_filters({
      category,
      subcategory,
      searchQuery,
      minPrice,
      maxPrice,
      inStockOnly,
      sortBy,
    });

    return NextResponse.json(products);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
