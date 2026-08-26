"""Optional catalog importer for a real DigiComp website.

Usage:
  python scripts_crawl_site.py https://YOUR-DIGICOMP-DOMAIN

It looks for sitemap.xml URLs and product JSON-LD (schema.org/Product), then writes
products into a JSON file that can be imported into the demo database.

This deliberately imports only products found on the specified DigiComp domain.
"""
from __future__ import annotations
import json, re, sys
from urllib.parse import urljoin, urlparse
import requests
from bs4 import BeautifulSoup

UA = {"User-Agent": "DigiComp-AI-Catalog-Sync/0.1"}

def get(url):
    r = requests.get(url, headers=UA, timeout=20)
    r.raise_for_status()
    return r.text

def urls_from_sitemap(base):
    candidates = [urljoin(base.rstrip('/')+'/', 'sitemap.xml'), urljoin(base.rstrip('/')+'/', 'sitemap_index.xml')]
    seen = set(); out=[]
    for u in candidates:
        try:
            xml = get(u)
        except Exception:
            continue
        for loc in re.findall(r'<loc>\s*(.*?)\s*</loc>', xml, re.I):
            if loc not in seen:
                seen.add(loc); out.append(loc)
    return out

def parse_products(page_url, html):
    soup = BeautifulSoup(html, 'html.parser')
    found=[]
    for script in soup.find_all('script', type='application/ld+json'):
        try:
            data=json.loads(script.string or script.get_text())
        except Exception:
            continue
        stack=data if isinstance(data,list) else [data]
        for item in stack:
            if isinstance(item, dict) and item.get('@type')=='Product':
                offers=item.get('offers') or {}
                if isinstance(offers,list): offers=offers[0] if offers else {}
                image=item.get('image') or ''
                if isinstance(image,list): image=image[0] if image else ''
                found.append({
                    'name': item.get('name','').strip(),
                    'description': (item.get('description') or '').strip(),
                    'sku': item.get('sku') or item.get('mpn') or '',
                    'image_url': urljoin(page_url, image) if image else '',
                    'product_url': item.get('url') or page_url,
                    'price': (offers.get('price') if isinstance(offers,dict) else None),
                    'availability': (offers.get('availability') if isinstance(offers,dict) else ''),
                    'source_url': page_url,
                })
    return found

def main():
    if len(sys.argv)!=2:
        raise SystemExit('Usage: python scripts_crawl_site.py https://your-digicomp-domain')
    base=sys.argv[1]
    host=urlparse(base).netloc
    sitemap_urls=urls_from_sitemap(base)
    product_urls=[]
    for u in sitemap_urls:
        if urlparse(u).netloc==host:
            product_urls.append(u)
    # If the sitemap itself has product pages, crawl those. Otherwise also accept a direct page list.
    product_urls=product_urls[:3000]
    all_products=[]
    for i,u in enumerate(product_urls,1):
        try:
            html=get(u)
            all_products.extend(parse_products(u,html))
        except Exception:
            pass
        if i%50==0: print(f'Crawled {i}/{len(product_urls)} pages...')
    # de-duplicate by URL/name
    unique={}
    for p in all_products:
        key=p['product_url'] or p['name']
        unique[key]=p
    out=list(unique.values())
    path='digicomp_catalog.json'
    with open(path,'w',encoding='utf-8') as f: json.dump(out,f,indent=2,ensure_ascii=False)
    print(f'Found {len(out)} DigiComp products. Wrote {path}.')

if __name__=='__main__': main()
