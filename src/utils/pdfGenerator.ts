// src/utils/pdfGenerator.ts
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { Product, ProductVariant } from '../firebase/firestore';

export const generateProductPDF = async (products: Product[], title: string = 'Products Catalog'): Promise<string> => {
  try {
    if (!products || products.length === 0) {
      throw new Error('No products to generate PDF');
    }

    const htmlContent = generateProductHTML(products, title);
    
    if (Platform.OS === 'web') {
      return await generatePDFForWeb(htmlContent, title);
    } else {
      return await generatePDFForMobile(htmlContent, title);
    }
  } catch (error: any) {
    console.error('PDF generation error:', error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
};

const generateProductHTML = (products: Product[], title: string): string => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const currentTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Split products into chunks of 2 for each page
  const productChunks = [];
  for (let i = 0; i < products.length; i += 2) {
    productChunks.push(products.slice(i, i + 2));
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          line-height: 1.6;
          color: #333;
          background: #fff;
          padding: 0;
          margin: 0;
        }
        
        .page {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
          page-break-after: always;
        }
        
        .page:last-child {
          page-break-after: auto;
        }
        
        .header {
          text-align: center;
          margin-bottom: 25px;
          padding-bottom: 15px;
          border-bottom: 3px solid #E6C76E;
        }
        
        .company-name {
          font-size: 52px;
          font-weight: normal;
          font-family: 'Brush Script MT', 'Segoe Script', cursive;
          color: #2c3e50;
          margin-bottom: 8px;
          letter-spacing: 1px;
        }
        
        .catalog-title {
          font-size: 24px;
          color: #7f8c8d;
          margin-bottom: 10px;
          font-weight: 600;
        }
        
        .product-count {
          font-size: 16px;
          color: #95a5a6;
          margin-bottom: 8px;
          background: #f8f9fa;
          padding: 8px 16px;
          border-radius: 20px;
          display: inline-block;
        }
        
        .date-info {
          font-size: 14px;
          color: #95a5a6;
          margin-bottom: 5px;
        }
        
        .products-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin-bottom: 30px;
        }
        
        .product-card {
          border: 2px solid #ecf0f1;
          border-radius: 12px;
          overflow: hidden;
          background: #fff;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
          transition: all 0.3s ease;
          break-inside: avoid;
        }
        
        .product-image-container {
          height: 280px;
          overflow: hidden;
          background: #f8f9fa;
          display: flex;
          align-items: center;
          justify-content: center;
          border-bottom: 2px solid #ecf0f1;
        }
        
        .product-image {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
        }
        
        .product-details {
          padding: 20px;
        }
        
        .product-title {
          font-size: 18px;
          font-weight: bold;
          color: #2c3e50;
          margin-bottom: 12px;
          line-height: 1.3;
        }
        
        .product-category {
          font-size: 14px;
          color: #7f8c8d;
          margin-bottom: 15px;
          background: #f8f9fa;
          padding: 4px 12px;
          border-radius: 12px;
          display: inline-block;
        }
        
        .variants-section {
          margin-bottom: 15px;
        }
        
        .variants-label {
          font-size: 14px;
          font-weight: 600;
          color: #34495e;
          margin-bottom: 8px;
          display: block;
        }
        
        .variants-container {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        
        .variant-chip {
          background: #E6C76E;
          color: #2c3e50;
          padding: 6px 12px;
          border-radius: 16px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid #d4b85a;
        }
        
        .pricing-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid #ecf0f1;
        }
        
        .price {
          font-size: 18px;
          font-weight: bold;
          color: #27ae60;
        }
        
        .cost-price {
          font-size: 14px;
          color: #95a5a6;
          text-decoration: line-through;
          margin-right: 8px;
        }
        
        .stock-info {
          font-size: 12px;
          color: #7f8c8d;
          background: #f8f9fa;
          padding: 4px 8px;
          border-radius: 8px;
        }
        
        .footer {
          text-align: center;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 2px solid #ecf0f1;
          color: #95a5a6;
          font-size: 12px;
        }
        
        .footer-main {
          font-weight: 600;
          margin-bottom: 4px;
          color: #2c3e50;
        }
        
        .page-info {
          font-size: 11px;
          color: #95a5a6;
          margin-top: 5px;
        }
        
        @media print {
          @page {
            margin: 1cm;
            size: A4;
          }
          
          body {
            margin: 0;
            -webkit-print-color-adjust: exact;
          }
          
          .page {
            padding: 0;
          }
          
          .product-card {
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          }
        }
        
        .no-image {
          text-align: center;
          color: #95a5a6;
          font-size: 14px;
          padding: 20px;
        }
        
        .description {
          font-size: 14px;
          color: #5d6d7e;
          margin-bottom: 15px;
          line-height: 1.5;
        }
      </style>
    </head>
    <body>
      ${productChunks.map((chunk, pageIndex) => `
        <div class="page">
          <div class="header">
            <div class="company-name">Obaby</div>
            <div class="product-count">Total Products: ${products.length}</div>
            <div class="date-info">Generated on ${currentDate} at ${currentTime}</div>
          </div>
          
          <div class="products-grid">
            ${chunk.map(product => generateProductCardHTML(product)).join('')}
          </div>
          
          <div class="footer">
            <div class="footer-main">Business Manager App by Adwyzors</div>
            <div class="page-info">Page ${pageIndex + 1} of ${productChunks.length}</div>
          </div>
        </div>
      `).join('')}
    </body>
    </html>
  `;
};

const generateProductCardHTML = (product: Product): string => {
  const mainImage = product.images && product.images.length > 0 ? product.images[0] : null;
  const hasVariants = product.sizes && product.sizes.length > 0;
  const totalStock = hasVariants ? 
    product.sizes.reduce((sum, variant) => sum + (variant.stock || 0), 0) : 0;
  
  const uniqueVariants = getUniqueVariants(product.sizes);

  return `
    <div class="product-card">
      <div class="product-image-container">
        ${mainImage ? 
          `<img src="${mainImage}" alt="${product.title}" class="product-image" onerror="this.style.display='none'; this.parentNode.innerHTML='<div class=\\'no-image\\'>No Image Available</div>';" />` : 
          `<div class="no-image">No Image Available</div>`
        }
      </div>
      
      <div class="product-details">
        <div class="product-title">${product.title || 'Untitled Product'}</div>
        
        ${product.category ? 
          `<div class="product-category">${product.category}</div>` : 
          ''
        }
        
        ${hasVariants ? `
          <div class="variants-section">
            <span class="variants-label">Available Variants:</span>
            <div class="variants-container">
              ${uniqueVariants.map(variant => `
                <span class="variant-chip">${variant.size}</span>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
};

const getUniqueVariants = (variants: ProductVariant[]): ProductVariant[] => {
  if (!variants || variants.length === 0) return [];
  
  const uniqueMap = new Map();
  variants.forEach(variant => {
    const key = `${variant.size}-${variant.color}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, variant);
    }
  });
  
  return Array.from(uniqueMap.values());
};

const generatePDFForWeb = async (htmlContent: string, title: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        reject(new Error('Failed to open print window'));
        return;
      }

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      printWindow.onload = () => {
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          resolve('pdf-generated');
        }, 500);
      };

      // Fallback if onload doesn't fire
      setTimeout(() => {
        if (printWindow.document.readyState === 'complete') {
          printWindow.focus();
          printWindow.print();
          resolve('pdf-generated');
        }
      }, 1000);

    } catch (error: any) {
      reject(new Error(`Web PDF generation failed: ${error.message}`));
    }
  });
};

const generatePDFForMobile = async (htmlContent: string, title: string): Promise<string> => {
  try {
    const { uri } = await Print.printToFileAsync({ 
      html: htmlContent,
      width: 612,
      height: 792,
      margins: {
        left: 36,
        top: 36,
        right: 36,
        bottom: 36
      }
    });

    if (!uri) {
      throw new Error('Failed to create PDF file');
    }

    return uri;

  } catch (error: any) {
    throw new Error(`Mobile PDF generation failed: ${error.message}`);
  }
};