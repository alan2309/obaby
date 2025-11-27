// src/utils/pdfGenerator.ts
import * as Print from "expo-print";
import { Platform } from "react-native";
import { Product, ProductVariant } from "../firebase/firestore";

export const generateProductPDF = async (
  products: Product[],
  title: string = "Products Catalog"
): Promise<string> => {
  try {
    if (!products || products.length === 0) {
      throw new Error("No products to generate PDF");
    }

    const htmlContent = generateProductHTML(products, title);

    if (Platform.OS === "web") {
      return await generatePDFForWeb(htmlContent, title);
    } else {
      return await generatePDFForMobile(htmlContent, title);
    }
  } catch (error: any) {
    console.error("PDF generation error:", error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
};

const generateProductHTML = (products: Product[], title: string): string => {
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const currentTime = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Each product gets its own page now
  const productPages = products.map((product, index) => ({
    product,
    pageNumber: index + 1,
  }));

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
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        
        .page:last-child {
          page-break-after: auto;
        }
        
        .header {
          text-align: center;
          margin-bottom: 25px;
          padding-bottom: 15px;
          border-bottom: 3px solid #E6C76E;
          flex-shrink: 0;
        }
        
        .company-name {
          font-size: 40px;
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
        
        .product-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          margin-bottom: 15px;
        }
        
        .product-card {
          border: 2px solid #ecf0f1;
          border-radius: 12px;
          overflow: hidden;
          background: #fff;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
          transition: all 0.3s ease;
          break-inside: avoid;
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
        }
        
        .product-image-container {
          min-height: 400px;
          overflow: visible;
          background: #f8f9fa;
          display: flex;
          align-items: center;
          justify-content: center;
          border-bottom: 2px solid #ecf0f1;
          padding: 10px;
        }
        
        .product-image {
          max-width: 100%;
          max-height: 600px;
          width: auto;
          height: auto;
          object-fit: contain;
          display: block;
        } 
        .product-header {
  text-align: center;
  margin-bottom: 15px;
}

.product-title {
  font-size: 20px;
  font-weight: bold;
  color: #2c3e50;
  line-height: 1.2;
  margin-right: 10px;
}

.product-category {
  font-size: 14px;
  color: #7f8c8d;
  background: #f8f9fa;
  padding: 4px 10px;
  border-radius: 12px;
  border: 1px solid #e1e8ed;
}
        
        .variants-section {
          margin-bottom: 20px;
          text-align: center;
        }
        
        .variants-label {
          font-size: 16px;
          font-weight: 600;
          color: #34495e;
          margin-bottom: 12px;
          display: block;
        }
        
        .variants-container {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
        }
        
        .variant-chip {
          background: #E6C76E;
          color: #2c3e50;
          padding: 8px 16px;
          border-radius: 16px;
          font-size: 14px;
          font-weight: 600;
          border: 1px solid #d4b85a;
        }
        .footer {
          text-align: center;
          margin-top: auto;
          padding-top: 20px;
          border-top: 2px solid #ecf0f1;
          color: #95a5a6;
          font-size: 12px;
          flex-shrink: 0;
        }
        
        .footer-main {
          font-weight: 600;
          color: #2c3e50;
        }
        
        .page-info {
          font-size: 10px;
          color: #95a5a6;
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
          
          .product-image-container {
            min-height: 350px;
            padding: 10px;
          }
          
          .product-image {
            max-height: 500px;
          }
        }
        
        .no-image {
          text-align: center;
          color: #95a5a6;
          font-size: 16px;
          padding: 40px 20px;
        }
        
        .product-info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-top: 20px;
        }
        
        .info-item {
          text-align: center;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 8px;
        }
        
        .info-label {
          font-size: 12px;
          color: #7f8c8d;
          margin-bottom: 5px;
        }
        
        .info-value {
          font-size: 16px;
          font-weight: 600;
          color: #2c3e50;
        }
      </style>
    </head>
    <body>
      ${productPages
        .map(
          ({ product, pageNumber }) => `
        <div class="page">
          <div class="header">
            <div class="company-name">Obaby</div>
            <div class="page-info">Generated on ${currentDate} at ${currentTime}</div>
          </div>
          
          <div class="product-container">
            ${generateProductCardHTML(product)}
          </div>
          
          <div class="footer">
            <div class="footer-main">Business Manager App by Adwyzors</div>
            <div class="page-info">Page ${pageNumber} of ${
            products.length
          }</div>
          </div>
        </div>
      `
        )
        .join("")}
    </body>
    </html>
  `;
};

const generateProductCardHTML = (product: Product): string => {
  const mainImage =
    product.images && product.images.length > 0 ? product.images[0] : null;
  const hasVariants = product.sizes && product.sizes.length > 0;

  const uniqueVariants = getUniqueVariants(product.sizes);

  return `
    <div class="product-card">
      <div class="product-image-container">
        ${
          mainImage
            ? `<img src="${mainImage}" alt="${product.title}" class="product-image" onerror="this.style.display='none'; this.parentNode.innerHTML='<div class=\\'no-image\\'>No Image Available</div>';" />`
            : `<div class="no-image">No Image Available</div>`
        }
      </div>
      
      <div class="product-details">
       <div class="product-header">
          <span class="product-title">${
            product.title || "Untitled Product"
          }</span>
          ${
            product.category
              ? `<span class="product-category">${product.category}</span>`
              : ""
          }
        </div>
        
        
        ${
          hasVariants
            ? `
          <div class="variants-section">
            <span class="variants-label">Available Variants:</span>
            <div class="variants-container">
              ${uniqueVariants
                .map(
                  (variant) => `
                <span class="variant-chip">${variant.size}</span>
              `
                )
                .join("")}
            </div>
          </div>
        `
            : ""
        }
      </div>
    </div>
  `;
};

const getUniqueVariants = (variants: ProductVariant[]): ProductVariant[] => {
  if (!variants || variants.length === 0) return [];

  const uniqueMap = new Map();
  variants.forEach((variant) => {
    const key = `${variant.size}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, variant);
    }
  });

  return Array.from(uniqueMap.values());
};

const generatePDFForWeb = async (
  htmlContent: string,
  title: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        reject(new Error("Failed to open print window"));
        return;
      }

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      printWindow.onload = () => {
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          resolve("pdf-generated");
        }, 500);
      };

      // Fallback if onload doesn't fire
      setTimeout(() => {
        if (printWindow.document.readyState === "complete") {
          printWindow.focus();
          printWindow.print();
          resolve("pdf-generated");
        }
      }, 1000);
    } catch (error: any) {
      reject(new Error(`Web PDF generation failed: ${error.message}`));
    }
  });
};

const generatePDFForMobile = async (
  htmlContent: string,
  title: string
): Promise<string> => {
  try {
    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      width: 612,
      height: 792,
      margins: {
        left: 36,
        top: 20,
        right: 36,
        bottom: 20,
      },
    });

    if (!uri) {
      throw new Error("Failed to create PDF file");
    }

    return uri;
  } catch (error: any) {
    throw new Error(`Mobile PDF generation failed: ${error.message}`);
  }
};
