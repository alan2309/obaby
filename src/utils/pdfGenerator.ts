// src/utils/pdfGenerator.ts
import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import { Product } from '../firebase/firestore';
import { sharePDF } from './shareUtils';

/**
 * Minimal Android-friendly PDF generator (Option A)
 * - Avoids Android-unfriendly CSS (no 100vh / fit-content)
 * - Sets explicit width/height to printToFileAsync
 * - Resizes Cloudinary images to reduce memory usage
 */

const DEFAULT_PAGE_WIDTH = 595; // ~A4 width at 72dpi
const DEFAULT_PAGE_HEIGHT = 842; // ~A4 height at 72dpi

// If your Cloudinary URLs follow the normal pattern, this injects a simple transformation
// to reduce image size. If it's not a Cloudinary URL it returns the original.
const getResizedImageUrl = (url?: string | null) => {
  if (!url) return '';
  try {
    // basic detection for Cloudinary hosted images
    if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
      // insert transformation after /upload/
      return url.replace(
        '/upload/',
        '/upload/w_800,q_70/' // width 800, quality 70 (smaller)
      );
    }
  } catch (e) {
    // fallback to original if anything unexpected
    return url;
  }
  return url;
};

export const generateProductPDF = async (
  products: Product[],
  categoryTitle: string = 'Products'
): Promise<string> => {
  try {
    const htmlContent = generateHTMLContent(products, categoryTitle);

    // 1. Generate PDF (temporary URI)
    const { uri: tempUri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
      width: DEFAULT_PAGE_WIDTH,
      height: DEFAULT_PAGE_HEIGHT,
    });

    console.log("TEMP PDF:", tempUri);

    // 2. Create a permanent file path
    const fileName = `${categoryTitle.replace(/\s+/g, "_")}_${Date.now()}.pdf`;
    // documentDirectory may not exist on the typed FileSystem import in some setups,
    // so access it dynamically and fall back to cacheDirectory or an empty string.
    const docDir = (FileSystem as any).documentDirectory ?? (FileSystem as any).cacheDirectory ?? '';
    const fileUri = docDir ? `${docDir}${fileName}` : fileName;

    // 3. Copy temp PDF → permanent location
    await FileSystem.copyAsync({
      from: tempUri,
      to: fileUri,
    });

    console.log("SAVED PDF:", fileUri);

    // 4. Automatically open the PDF
    await Print.printAsync({ uri: fileUri });

    return fileUri;

  } catch (error: any) {
    console.log("PDF ERROR:", error);
    throw new Error(`Failed to generate PDF: ${error?.message || error}`);
  }
};


const generateHTMLContent = (products: Product[], categoryTitle: string): string => {
  const currentDate = new Date().toLocaleDateString();
  const totalProducts = Array.isArray(products) ? products.length : 0;

  // Split products into chunks for multiple pages (6 products per page)
  const productsPerPage = 6;
  const productChunks: Product[][] = [];
  for (let i = 0; i < (products || []).length; i += productsPerPage) {
    productChunks.push(products.slice(i, i + productsPerPage));
  }

  // helper to safely format price
  const fmtPrice = (p: any) => {
    const n = typeof p === 'number' ? p : parseFloat(String(p || '0'));
    if (Number.isFinite(n)) return n.toFixed(2);
    return '0.00';
  };

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>${escapeHtml(categoryTitle)} - Product Catalog</title>
    <style>
      @media print {
        .page-break {
          page-break-after: always;
        }
        body {
          margin: 0;
          padding: 0;
        }
      }

      body {
        font-family: Arial, sans-serif;
        margin: 0;
        padding: 12px;
        color: #333;
        background: white;
        width: 100%;
      }

      /* Use a fixed page height (A4-like) instead of 100vh which Android dislikes */
      .page {
        page-break-after: always;
        width: 100%;
        height: 842px; /* A4-ish at 72dpi */
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        padding: 8px;
      }

      .page:last-child {
        page-break-after: auto;
      }

      .header {
        text-align: center;
        margin-bottom: 10px;
        border-bottom: 1px solid #4ECDC4;
        padding-bottom: 10px;
      }

      .header h1 {
        color: #2C3E50;
        margin: 0;
        font-size: 18px;
      }

      .header .subtitle {
        color: #7F8C8D;
        font-size: 11px;
        margin-top: 4px;
      }

      .summary {
        background: #F8F9FA;
        padding: 8px;
        border-radius: 6px;
        margin-bottom: 10px;
        border-left: 3px solid #4ECDC4;
        text-align: center;
        font-weight: bold;
        font-size: 12px;
      }

      /* Simple 2-column grid */
      .product-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        margin-top: 10px;
        flex: 1;
      }

      .product-card {
        border: 1px solid #E0E0E0;
        border-radius: 6px;
        padding: 10px;
        background: white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        display: flex;
        flex-direction: column;
        page-break-inside: avoid;
        break-inside: avoid;
        height: auto; /* let browser calculate */
        box-sizing: border-box;
      }

      .image-container {
        width: 100%;
        height: 140px;
        overflow: hidden;
        border-radius: 4px;
        margin-bottom: 8px;
        background: #f5f5f5;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .product-image {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        object-position: center;
        display: block;
      }

      .no-image {
        width: 100%;
        height: 100%;
        background: #F7CAC9;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #2C3E50;
        font-style: italic;
        font-size: 11px;
      }

      .product-title {
        font-size: 12px;
        font-weight: bold;
        color: #2C3E50;
        margin-bottom: 6px;
        text-align: center;
        line-height: 1.2;
        min-height: 34px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .product-price {
        font-size: 13px;
        color: #27AE60;
        font-weight: bold;
        margin-bottom: 6px;
        text-align: center;
      }

      .sizes-container {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        justify-content: center;
        margin-top: 8px;
        padding: 6px;
        background: #F8F9FA;
        border-radius: 4px;
      }

      .size-chip {
        background: white;
        border: 1px solid #E0E0E0;
        border-radius: 4px;
        padding: 4px 6px;
        font-size: 9px;
        font-weight: 600;
        color: #333;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .size-text {
        font-weight: bold;
      }

      .stock-text {
        font-size: 8px;
        color: #666;
        font-weight: 500;
      }

      .footer {
        margin-top: 10px;
        text-align: center;
        color: #7F8C8D;
        font-size: 10px;
        border-top: 1px solid #E0E0E0;
        padding-top: 10px;
      }

      .category-chip {
        display: inline-block;
        background: #E3F2FD;
        border: 1px solid #2196F3;
        border-radius: 10px;
        padding: 2px 6px;
        font-size: 8px;
        color: #1976D2;
        margin-bottom: 4px;
      }

      .stock-info {
        text-align: center;
        font-size: 9px;
        color: #666;
        margin-bottom: 4px;
      }

      .in-stock { color: #4CAF50; }
      .out-of-stock { color: #FF5252; }

      .page-number {
        text-align: center;
        font-size: 10px;
        color: #7F8C8D;
        margin-top: 8px;
      }
    </style>
  </head>
  <body>
    ${productChunks
      .map((chunk, pageIndex) => {
        return `
        <div class="page">
          <div class="header">
            <h1>${escapeHtml(categoryTitle)} - Product Catalog</h1>
            <div class="subtitle">Generated on ${escapeHtml(currentDate)}</div>
          </div>

          ${
            pageIndex === 0
              ? `<div class="summary">Total Products: ${escapeHtml(String(totalProducts))}</div>`
              : `<div class="summary">Page ${pageIndex + 1} of ${productChunks.length}</div>`
          }

          <div class="product-grid">
            ${chunk
              .map((product) => {
                const sizes = Array.isArray(product.sizes) ? product.sizes : [];
                const totalStock = sizes.reduce((sum: number, variant: any) => {
                  const s = Number(variant?.stock ?? 0);
                  return sum + (Number.isFinite(s) ? s : 0);
                }, 0);
                const isOutOfStock = totalStock === 0;
                const availableSizes = sizes.filter((v: any) => Number(v?.stock) > 0);

                const safeImage = getResizedImageUrl(product.images?.[0]);

                return `
                  <div class="product-card">
                    <div class="image-container">
                      ${
                        safeImage
                          ? `<img src="${escapeHtml(safeImage)}" class="product-image" alt="${escapeHtml(
                              product.title ?? 'Product'
                            )}" />`
                          : `<div class="no-image">No Image</div>`
                      }
                    </div>

                    <div class="product-title">${escapeHtml(product.title ?? 'Untitled')}</div>
                    <div class="product-price">₹${escapeHtml(fmtPrice(product.sellingPrice))}</div>

                    ${
                      product.category
                        ? `<div style="text-align:center;"><span class="category-chip">${escapeHtml(product.category)}</span></div>`
                        : ''
                    }

                    <div class="stock-info ${isOutOfStock ? 'out-of-stock' : 'in-stock'}">
                      ${isOutOfStock ? 'Out of stock' : `${escapeHtml(String(totalStock))} in stock`}
                    </div>

                    ${
                      availableSizes.length > 0
                        ? `<div class="sizes-container">
                            ${availableSizes
                              .slice(0, 4)
                              .map(
                                (variant: any) => `
                              <div class="size-chip">
                                <span class="size-text">${escapeHtml(String(variant.size ?? ''))}</span>
                                ${
                                  variant.color && variant.color !== 'Default'
                                    ? `<span style="margin-left: 4px; font-size: 8px; color: #666;">• ${escapeHtml(
                                        String(variant.color)
                                      )}</span>`
                                    : ''
                                }
                                <span class="stock-text">${escapeHtml(String(variant.stock ?? ''))}</span>
                              </div>
                            `
                              )
                              .join('')}
                            ${
                              availableSizes.length > 4
                                ? `<div class="size-chip" style="background: #FFF9C4;">
                                    <span style="font-size: 8px;">+${escapeHtml(String(availableSizes.length - 4))} more</span>
                                  </div>`
                                : ''
                            }
                          </div>`
                        : sizes.length > 0
                        ? `<div class="sizes-container"><div style="color:#999;font-size:9px;text-align:center;">Out of stock</div></div>`
                        : `<div class="sizes-container"><div style="color:#999;font-size:9px;text-align:center;">No variants</div></div>`
                    }
                  </div>
                `;
              })
              .join('')}
          </div>

          <div class="footer">
            Generated by Business Manager App • ${escapeHtml(currentDate)} • Page ${pageIndex + 1} of ${
          productChunks.length
        }
          </div>
        </div>
      `;
      })
      .join('')}
  </body>
  </html>
  `;
};

/**
 * Very small HTML escape to avoid breaking the HTML if product titles contain <>&"
 */
const escapeHtml = (unsafe: string) => {
  return String(unsafe)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
};

export default generateProductPDF;
