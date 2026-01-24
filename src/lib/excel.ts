import * as XLSX from 'xlsx';
import { Product, Client, Supplier } from '@/types/erp';

// Generic export to Excel for any data
export function exportToExcel(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return;
  
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Dados');
  
  // Auto-size columns
  const colWidths = Object.keys(data[0] || {}).map(key => ({ wch: Math.max(key.length, 15) }));
  ws['!cols'] = colWidths;

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// Export clients to Excel
export function exportClientsToExcel(clients: Client[], filename: string = 'clientes.xlsx') {
  const data = clients.map(c => ({
    'Código': c.id.slice(0, 8).toUpperCase(),
    'Nome': c.name,
    'NIF': c.nif,
    'Telefone': c.phone || '',
    'Email': c.email || '',
    'Morada': c.address || '',
    'Cidade': c.city || '',
    'País': c.country,
    'Limite Crédito': c.creditLimit,
    'Saldo Actual': c.currentBalance,
    'Estado': c.isActive ? 'Activo' : 'Inactivo',
    'Data Criação': c.createdAt ? new Date(c.createdAt).toLocaleDateString('pt-AO') : '',
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
  
  const colWidths = Object.keys(data[0] || {}).map(key => ({ wch: Math.max(key.length, 15) }));
  ws['!cols'] = colWidths;

  XLSX.writeFile(wb, filename);
}

// Export suppliers to Excel
export function exportSuppliersToExcel(suppliers: Supplier[], filename: string = 'fornecedores.xlsx') {
  const data = suppliers.map(s => ({
    'Código': s.id.slice(0, 8).toUpperCase(),
    'Nome': s.name,
    'NIF': s.nif,
    'Pessoa Contacto': s.contactPerson || '',
    'Telefone': s.phone || '',
    'Email': s.email || '',
    'Morada': s.address || '',
    'Cidade': s.city || '',
    'País': s.country,
    'Prazo Pagamento': s.paymentTerms,
    'Estado': s.isActive ? 'Activo' : 'Inactivo',
    'Notas': s.notes || '',
    'Data Criação': s.createdAt ? new Date(s.createdAt).toLocaleDateString('pt-AO') : '',
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Fornecedores');
  
  const colWidths = Object.keys(data[0] || {}).map(key => ({ wch: Math.max(key.length, 15) }));
  ws['!cols'] = colWidths;

  XLSX.writeFile(wb, filename);
}

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
      errors.push({ row: index + 2, errors: rowErrors });
    } else {
      valid.push(product);
    }
  });

  return { valid, errors };
}

// ============ CLIENT IMPORT ============

export interface ExcelClient {
  nome: string;
  nif: string;
  telefone?: string;
  email?: string;
  morada?: string;
  cidade?: string;
  pais?: string;
  limiteCredito?: number;
}

export async function parseClientsFromExcel(file: File): Promise<ExcelClient[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        const clients: ExcelClient[] = jsonData.map((row: any) => ({
          nome: String(row['Nome'] || row['nome'] || row['Name'] || ''),
          nif: String(row['NIF'] || row['nif'] || row['Nif'] || ''),
          telefone: row['Telefone'] || row['telefone'] || row['Phone'] || '',
          email: row['Email'] || row['email'] || '',
          morada: row['Morada'] || row['morada'] || row['Endereço'] || row['Address'] || '',
          cidade: row['Cidade'] || row['cidade'] || row['City'] || '',
          pais: row['País'] || row['pais'] || row['Country'] || 'Angola',
          limiteCredito: parseFloat(row['Limite Crédito'] || row['limite_credito'] || row['Credit Limit'] || 0),
        }));
        
        resolve(clients);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Falha ao ler ficheiro'));
    reader.readAsArrayBuffer(file);
  });
}

export function validateImportedClients(clients: ExcelClient[]): {
  valid: ExcelClient[];
  errors: { row: number; errors: string[] }[];
} {
  const valid: ExcelClient[] = [];
  const errors: { row: number; errors: string[] }[] = [];

  clients.forEach((client, index) => {
    const rowErrors: string[] = [];
    
    if (!client.nome) {
      rowErrors.push('Nome é obrigatório');
    }
    if (!client.nif) {
      rowErrors.push('NIF é obrigatório');
    } else if (client.nif.length < 9) {
      rowErrors.push('NIF deve ter pelo menos 9 caracteres');
    }

    if (rowErrors.length > 0) {
      errors.push({ row: index + 2, errors: rowErrors });
    } else {
      valid.push(client);
    }
  });

  return { valid, errors };
}

export function downloadClientImportTemplate() {
  const templateData = [
    {
      'Nome': 'Cliente Exemplo Lda',
      'NIF': '5000123456',
      'Telefone': '+244 923 456 789',
      'Email': 'cliente@exemplo.ao',
      'Morada': 'Rua Principal, 123',
      'Cidade': 'Luanda',
      'País': 'Angola',
      'Limite Crédito': 500000,
    }
  ];

  const ws = XLSX.utils.json_to_sheet(templateData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  
  XLSX.writeFile(wb, 'template_importacao_clientes.xlsx');
}

// ============ SUPPLIER IMPORT ============

export interface ExcelSupplier {
  nome: string;
  nif: string;
  pessoaContacto?: string;
  telefone?: string;
  email?: string;
  morada?: string;
  cidade?: string;
  pais?: string;
  prazoPagamento?: string;
  notas?: string;
}

export async function parseSuppliersFromExcel(file: File): Promise<ExcelSupplier[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        const suppliers: ExcelSupplier[] = jsonData.map((row: any) => ({
          nome: String(row['Nome'] || row['nome'] || row['Name'] || ''),
          nif: String(row['NIF'] || row['nif'] || row['Nif'] || ''),
          pessoaContacto: row['Pessoa Contacto'] || row['pessoa_contacto'] || row['Contact Person'] || '',
          telefone: row['Telefone'] || row['telefone'] || row['Phone'] || '',
          email: row['Email'] || row['email'] || '',
          morada: row['Morada'] || row['morada'] || row['Endereço'] || row['Address'] || '',
          cidade: row['Cidade'] || row['cidade'] || row['City'] || '',
          pais: row['País'] || row['pais'] || row['Country'] || 'Angola',
          prazoPagamento: row['Prazo Pagamento'] || row['prazo_pagamento'] || row['Payment Terms'] || 'immediate',
          notas: row['Notas'] || row['notas'] || row['Notes'] || '',
        }));
        
        resolve(suppliers);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Falha ao ler ficheiro'));
    reader.readAsArrayBuffer(file);
  });
}

export function validateImportedSuppliers(suppliers: ExcelSupplier[]): {
  valid: ExcelSupplier[];
  errors: { row: number; errors: string[] }[];
} {
  const valid: ExcelSupplier[] = [];
  const errors: { row: number; errors: string[] }[] = [];

  suppliers.forEach((supplier, index) => {
    const rowErrors: string[] = [];
    
    if (!supplier.nome) {
      rowErrors.push('Nome é obrigatório');
    }
    if (!supplier.nif) {
      rowErrors.push('NIF é obrigatório');
    } else if (supplier.nif.length < 9) {
      rowErrors.push('NIF deve ter pelo menos 9 caracteres');
    }

    if (rowErrors.length > 0) {
      errors.push({ row: index + 2, errors: rowErrors });
    } else {
      valid.push(supplier);
    }
  });

  return { valid, errors };
}

export function downloadSupplierImportTemplate() {
  const templateData = [
    {
      'Nome': 'Fornecedor Exemplo Lda',
      'NIF': '5000123456',
      'Pessoa Contacto': 'João Silva',
      'Telefone': '+244 923 456 789',
      'Email': 'fornecedor@exemplo.ao',
      'Morada': 'Rua Principal, 123',
      'Cidade': 'Luanda',
      'País': 'Angola',
      'Prazo Pagamento': '30_days',
      'Notas': 'Observações adicionais',
    }
  ];

  const ws = XLSX.utils.json_to_sheet(templateData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  
  XLSX.writeFile(wb, 'template_importacao_fornecedores.xlsx');
}
