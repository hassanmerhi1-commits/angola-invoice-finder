import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download, X } from 'lucide-react';

interface ImportError {
  row: number;
  errors: string[];
}

interface ExcelImportDialogProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  parseFile: (file: File) => Promise<T[]>;
  validateData: (data: T[]) => { valid: T[]; errors: ImportError[] };
  onImport: (data: T[]) => void;
  downloadTemplate: () => void;
  columns: { key: keyof T; label: string }[];
}

export function ExcelImportDialog<T>({
  open,
  onOpenChange,
  title,
  description,
  parseFile,
  validateData,
  onImport,
  downloadTemplate,
  columns,
}: ExcelImportDialogProps<T>) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');
  const [parsedData, setParsedData] = useState<T[]>([]);
  const [validData, setValidData] = useState<T[]>([]);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    
    try {
      const data = await parseFile(file);
      setParsedData(data);
      
      const { valid, errors } = validateData(data);
      setValidData(valid);
      setErrors(errors);
      setStep('preview');
    } catch (error) {
      console.error('Error parsing file:', error);
      setErrors([{ row: 0, errors: ['Erro ao processar ficheiro. Verifique o formato.'] }]);
    }
  };

  const handleImport = () => {
    setStep('importing');
    onImport(validData);
    handleClose();
  };

  const handleClose = () => {
    setStep('upload');
    setParsedData([]);
    setValidData([]);
    setErrors([]);
    setFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onOpenChange(false);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {step === 'upload' && (
            <div className="space-y-4">
              <div 
                onClick={triggerFileInput}
                className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-primary transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">Clique para selecionar ficheiro</p>
                <p className="text-sm text-muted-foreground">
                  Suporta ficheiros Excel (.xlsx, .xls) e CSV
                </p>
              </div>

              <div className="flex justify-center">
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="w-4 h-4 mr-2" />
                  Baixar Template de Exemplo
                </Button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                  <span className="font-medium">{fileName}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setStep('upload')}>
                  <X className="w-4 h-4 mr-1" />
                  Escolher outro ficheiro
                </Button>
              </div>

              <div className="flex gap-4">
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {validData.length} válidos
                </Badge>
                {errors.length > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.length} com erros
                  </Badge>
                )}
              </div>

              {errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium mb-1">Erros encontrados:</div>
                    <ul className="list-disc list-inside text-sm max-h-24 overflow-auto">
                      {errors.slice(0, 5).map((error, idx) => (
                        <li key={idx}>
                          Linha {error.row}: {error.errors.join(', ')}
                        </li>
                      ))}
                      {errors.length > 5 && (
                        <li>... e mais {errors.length - 5} erros</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {validData.length > 0 && (
                <ScrollArea className="h-[300px] border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        {columns.map((col) => (
                          <TableHead key={String(col.key)}>{col.label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validData.slice(0, 100).map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                          {columns.map((col) => (
                            <TableCell key={String(col.key)}>
                              {String(row[col.key] || '-')}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {validData.length > 100 && (
                    <div className="p-2 text-center text-sm text-muted-foreground border-t">
                      Mostrando 100 de {validData.length} registos
                    </div>
                  )}
                </ScrollArea>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          {step === 'preview' && validData.length > 0 && (
            <Button onClick={handleImport}>
              <Upload className="w-4 h-4 mr-2" />
              Importar {validData.length} registos
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
