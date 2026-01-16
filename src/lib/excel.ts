import * as XLSX from 'xlsx';
import { Product } from '@/types/erp';

export interface ExcelProduct {
  codigo: string;
  descricao: string;
  preco: number;
  custo: number;
  quantidade: number;
  unidade: string;
  categoria: string;
  iva: number;
  codigoBarras?: string;
  fornecedor?: string;
  qtdMinima?: number;
  localizacao?: string;
}

// Export products to Excel
export function exportProductsToExcel(products: Product[], filename: string = 'produtos.xlsx') {
  const data = products.map(p => ({
    'Código': p.sku,
    'Descrição': p.name,
    'Código de Barras': p.barcode || '',
    'Categoria': p.category,
    'Preço Venda': p.price,
    'Preço Custo': p.cost,
    'Quantidade': p.stock,
    'Unidade': p.unit,
    'IVA %': p.taxRate,
    'Activo': p.isActive ? 'Sim' : 'Não',
    'Filial': p.branchId,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
  
  // Auto-size columns
  const colWidths = Object.keys(data[0] || {}).map(key => ({ wch: Math.max(key.length, 15) }));
  ws['!cols'] = colWidths;

  XLSX.writeFile(wb, filename);
}

// Export to CSV
export function exportProductsToCSV(products: Product[], filename: string = 'produtos.csv') {
  const data = products.map(p => ({
    codigo: p.sku,
    descricao: p.name,
    codigo_barras: p.barcode || '',
    categoria: p.category,
    preco_venda: p.price,
    preco_custo: p.cost,
    quantidade: p.stock,
    unidade: p.unit,
    iva: p.taxRate,
    activo: p.isActive ? '1' : '0',
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(ws);
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Parse Excel file
export async function parseExcelFile(file: File): Promise<ExcelProduct[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        const products: ExcelProduct[] = jsonData.map((row: any) => ({
          codigo: String(row['Código'] || row['codigo'] || row['SKU'] || row['sku'] || ''),
          descricao: String(row['Descrição'] || row['descricao'] || row['Nome'] || row['nome'] || row['Produto'] || ''),
          preco: parseFloat(row['Preço Venda'] || row['preco'] || row['Preço'] || row['Price'] || 0),
          custo: parseFloat(row['Preço Custo'] || row['custo'] || row['Cost'] || 0),
          quantidade: parseInt(row['Quantidade'] || row['quantidade'] || row['Stock'] || row['Qty'] || 0),
          unidade: String(row['Unidade'] || row['unidade'] || row['Unit'] || 'UN'),
          categoria: String(row['Categoria'] || row['categoria'] || row['Category'] || ''),
          iva: parseFloat(row['IVA %'] || row['iva'] || row['IVA'] || row['Tax'] || 14),
          codigoBarras: row['Código de Barras'] || row['codigo_barras'] || row['Barcode'] || '',
          fornecedor: row['Fornecedor'] || row['fornecedor'] || row['Supplier'] || '',
          qtdMinima: parseInt(row['Qtd Mínima'] || row['qtd_minima'] || row['Min Qty'] || 0),
          localizacao: row['Localização'] || row['localizacao'] || row['Location'] || '',
        }));
        
        resolve(products);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

// Generate Excel template for import
export function downloadImportTemplate() {
  const templateData = [
    {
      'Código': 'PROD001',
      'Descrição': 'Exemplo de Produto',
      'Código de Barras': '1234567890123',
      'Categoria': 'GERAL',
      'Preço Venda': 1000,
      'Preço Custo': 700,
      'Quantidade': 100,
      'Unidade': 'UN',
      'IVA %': 14,
      'Fornecedor': 'Fornecedor Exemplo',
      'Qtd Mínima': 10,
      'Localização': 'A1',
    }
  ];

  const ws = XLSX.utils.json_to_sheet(templateData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  
  XLSX.writeFile(wb, 'template_importacao_produtos.xlsx');
}

// Validate imported products
export function validateImportedProducts(products: ExcelProduct[]): {
  valid: ExcelProduct[];
  errors: { row: number; errors: string[] }[];
} {
  const valid: ExcelProduct[] = [];
  const errors: { row: number; errors: string[] }[] = [];

  products.forEach((product, index) => {
    const rowErrors: string[] = [];
    
    if (!product.codigo) {
      rowErrors.push('Código é obrigatório');
    }
    if (!product.descricao) {
      rowErrors.push('Descrição é obrigatória');
    }
    if (product.preco < 0) {
      rowErrors.push('Preço não pode ser negativo');
    }
    if (product.quantidade < 0) {
      rowErrors.push('Quantidade não pode ser negativa');
    }
    if (product.iva < 0 || product.iva > 100) {
      rowErrors.push('IVA deve estar entre 0 e 100');
    }

    if (rowErrors.length > 0) {
      errors.push({ row: index + 2, errors: rowErrors }); // +2 for header + 1-indexed
    } else {
      valid.push(product);
    }
  });

  return { valid, errors };
}
