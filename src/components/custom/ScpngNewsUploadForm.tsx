import React, { useState, useEffect } from 'react';
import { logger } from '@/lib/supabaseClient';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Expand } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMicrosoftGraph } from '@/hooks/useMicrosoftGraph';
import { NewsSharePointService } from '@/services/newsSharePointService';

// SharePoint Configuration (Update these if your asset modal uses different values)
const SHAREPOINT_SITEPATH = "/sites/scpngintranet";
const SHAREPOINT_LIBRARY_NAME = "Asset Images"; // Assuming this is your general asset library
const SHAREPOINT_TARGET_FOLDER = "NewsImages"; // Subfolder for news images

interface ScpngNewsUploadFormProps {
  onUploadSuccess: () => void;
}

const ScpngNewsUploadForm: React.FC<ScpngNewsUploadFormProps> = ({ onUploadSuccess }) => {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]); // Default to today
  const [sourceName, setSourceName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [category, setCategory] = useState('SCPNG News');
  const [country, setCountry] = useState('PAPUA NEW GUINEA');
  const [aiSummary, setAiSummary] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isEnlargedFormOpen, setIsEnlargedFormOpen] = useState(false);

  const graphContext = useMicrosoftGraph();

  // Auto-set country based on category selection
  useEffect(() => {
    if (category === 'National News') {
      setCountry('PAPUA NEW GUINEA');
    } else if (category === 'Global Insights') {
      if (country === 'PAPUA NEW GUINEA') {
        setCountry(''); // Clear it for user to enter, or set a default global one
      }
    }
  }, [category]);

  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setImageFile(event.target.files[0]);
      setImageUrl(''); // Clear URL if file is selected
    }
  };

  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    let finalImageUrl = imageUrl;

    try {
      if (imageFile) {
        logger.info(`[ScpngNewsUploadForm] Attempting to upload image to SharePoint...`);

        if (graphContext.uploadBinaryFileToSharePoint) {
          const fileName = `${uuidv4()}-${imageFile.name}`; // Create a unique filename

          const sharepointUrl = await graphContext.uploadBinaryFileToSharePoint(
            imageFile,
            fileName,
            SHAREPOINT_SITEPATH,
            SHAREPOINT_LIBRARY_NAME,
            SHAREPOINT_TARGET_FOLDER
          );

          if (sharepointUrl) {
            finalImageUrl = sharepointUrl;
            logger.success(`[ScpngNewsUploadForm] Image uploaded to SharePoint successfully. URL: ${finalImageUrl}`);
          } else {
            logger.error('[ScpngNewsUploadForm] SharePoint image upload failed. Error (if any):', graphContext.lastError);
            throw new Error(`Image upload to SharePoint failed. ${graphContext.lastError || 'Please ensure you are logged in and have permissions.'}`);
          }
        } else {
          logger.error('[ScpngNewsUploadForm] uploadBinaryFileToSharePoint function is not available.');
          throw new Error('SharePoint upload functionality is not available.');
        }
      } else if (imageUrl) {
        finalImageUrl = imageUrl;
        logger.info(`[ScpngNewsUploadForm] Using provided image URL: ${finalImageUrl}`);
      }

      const generatedArticleId = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now();
      const finalSourceUrl = sourceUrl || `#article-${generatedArticleId}`;

      logger.info('[ScpngNewsUploadForm] Creating news item in SharePoint...');

      const client = await graphContext.getClient();
      if (!client) throw new Error("Failed to initialize Graph Client");

      const newsService = new NewsSharePointService(client);

      await newsService.createNewsItem({
        title,
        description: summary,
        category: category,
        imageUrl: finalImageUrl,
        publishDate: new Date(date).toISOString(),
        sourceName: sourceName,
        sourceUrl: finalSourceUrl,
        aiSummary: aiSummary,
        country: country,
        isActive: true,
        articleId: generatedArticleId
      });

      logger.success('[ScpngNewsUploadForm] News article submitted successfully to SharePoint.');
      setSuccessMessage('Article uploaded successfully!');

      // Reset form
      setTitle('');
      setSummary('');
      setDate(new Date().toISOString().split('T')[0]);
      setSourceName('');
      setSourceUrl('');
      setImageUrl('');
      setImageFile(null);
      setAiSummary('');
      setCategory('SCPNG News');
      setCountry('PAPUA NEW GUINEA');

      setIsEnlargedFormOpen(false); // Close modal on successful submission
      onUploadSuccess(); // Callback to refresh parent component's list

    } catch (err: any) {
      logger.error('[ScpngNewsUploadForm] Error in handleSubmit:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderFormFields = (isTwoColumnLayout: boolean = false) => {
    if (isTwoColumnLayout) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 py-2">
          {/* Column 1: Title and Summary */}
          <div className="space-y-4 md:col-span-1">
            <div>
              <label htmlFor="title-field-modal" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Title</label>
              <Input id="title-field-modal" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Enter article title" className="dark:bg-white/5 dark:border-white/10 focus:ring-intranet-primary" />
            </div>
            <div>
              <label htmlFor="summary-field-modal" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <Textarea
                id="summary-field-modal"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                required
                rows={10}
                placeholder="Enter a concise description of the article"
                className="min-h-[200px] dark:bg-white/5 dark:border-white/10 focus:ring-intranet-primary"
              />
            </div>
            <div>
              <label htmlFor="aiSummary-field-modal" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">AI Summary (Optional)</label>
              <Textarea
                id="aiSummary-field-modal"
                value={aiSummary}
                onChange={(e) => setAiSummary(e.target.value)}
                rows={5}
                placeholder="Enter AI generated summary if available"
                className="dark:bg-white/5 dark:border-white/10 focus:ring-intranet-primary"
              />
            </div>
          </div>

          {/* Column 2: Other fields */}
          <div className="space-y-4 md:col-span-1">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="category-field-modal" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category-field-modal" className="dark:bg-white/5 dark:border-white/10">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-900 dark:border-white/10">
                    <SelectItem value="SCPNG News">SCPNG News</SelectItem>
                    <SelectItem value="National News">National News</SelectItem>
                    <SelectItem value="Global Insights">Global Insights</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label htmlFor="country-field-modal" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Country</label>
                <Input id="country-field-modal" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. PAPUA NEW GUINEA" className="dark:bg-white/5 dark:border-white/10" />
              </div>
            </div>

            <div>
              <label htmlFor="date-field-modal" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Date</label>
              <Input id="date-field-modal" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="dark:bg-white/5 dark:border-white/10" />
            </div>
            <div>
              <label htmlFor="sourceName-field-modal" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Source Name (Optional)</label>
              <Input id="sourceName-field-modal" value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="e.g., Internal Memo, HR Department" className="dark:bg-white/5 dark:border-white/10" />
            </div>
            <div>
              <label htmlFor="sourceUrl-field-modal" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Source URL (Optional)</label>
              <Input id="sourceUrl-field-modal" type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://example.com/news-story" className="dark:bg-white/5 dark:border-white/10" />
            </div>
            <div>
              <label htmlFor="imageUrl-field-modal" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Image URL (Optional)</label>
              <Input id="imageUrl-field-modal" type="url" value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setImageFile(null); }} placeholder="https://example.com/image.png" className="dark:bg-white/5 dark:border-white/10" />
            </div>
            <div>
              <label htmlFor="imageFile-field-modal" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Or Upload Image (Optional)</label>
              <Input id="imageFile-field-modal" type="file" accept="image/*" onChange={handleImageFileChange} className="dark:bg-white/5 dark:border-white/10" />
              {imageFile && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Selected: {imageFile.name}</p>}
            </div>
          </div>

          {/* Error and Success messages span across columns or are placed below */}
          {(error || successMessage) && (
            <div className="md:col-span-2">
              {error && <p className="text-red-500 text-sm py-2">Error: {error}</p>}
              {successMessage && <p className="text-green-500 text-sm py-2">{successMessage}</p>}
            </div>
          )}
        </div>
      );
    }

    // Original single-column layout for the non-modal form (Simplified for quick upload)
    return (
      <div className="space-y-4 py-2">
        <div>
          <label htmlFor="title-field-inline" className="block text-sm font-semibold dark:text-gray-300 mb-1">Title</label>
          <Input id="title-field-inline" value={title} onChange={(e) => setTitle(e.target.value)} required className="dark:bg-white/5 dark:border-white/10" />
        </div>
        <div>
          <label htmlFor="category-field-inline" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Category</label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="category-field-inline" className="dark:bg-white/5 dark:border-white/10">
              <SelectValue placeholder="Select Category" />
            </SelectTrigger>
            <SelectContent className="dark:bg-gray-800 dark:border-white/10">
              <SelectItem value="SCPNG News">SCPNG News</SelectItem>
              <SelectItem value="National News">National News</SelectItem>
              <SelectItem value="Global Insights">Global Insights</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label htmlFor="summary-field-inline" className="block text-sm font-semibold dark:text-gray-300 mb-1">Description</label>
          <Textarea id="summary-field-inline" value={summary} onChange={(e) => setSummary(e.target.value)} required rows={3} className="dark:bg-white/5 dark:border-white/10" />
        </div>
        <div>
          <label htmlFor="date-field-inline" className="block text-sm font-semibold dark:text-gray-300 mb-1">Date</label>
          <Input id="date-field-inline" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="dark:bg-white/5 dark:border-white/10" />
        </div>
        <div>
          <label htmlFor="sourceName-field-inline" className="block text-sm font-semibold dark:text-gray-300 mb-1">Source Name (Optional)</label>
          <Input id="sourceName-field-inline" value={sourceName} onChange={(e) => setSourceName(e.target.value)} className="dark:bg-white/5 dark:border-white/10" />
        </div>
        <div>
          <label htmlFor="sourceUrl-field-inline" className="block text-sm font-semibold dark:text-gray-300 mb-1">Source URL (Optional)</label>
          <Input id="sourceUrl-field-inline" type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://example.com/news-story" className="dark:bg-white/5 dark:border-white/10" />
        </div>
        <div>
          <label htmlFor="imageUrl-field-inline" className="block text-sm font-semibold dark:text-gray-300 mb-1">Image URL (Optional)</label>
          <Input id="imageUrl-field-inline" type="url" value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setImageFile(null); }} placeholder="https://example.com/image.png" className="dark:bg-white/5 dark:border-white/10" />
        </div>
        <div>
          <label htmlFor="imageFile-field-inline" className="block text-sm font-semibold dark:text-gray-300 mb-1">Or Upload Image (Optional)</label>
          <Input id="imageFile-field-inline" type="file" accept="image/*" onChange={handleImageFileChange} className="dark:bg-white/5 dark:border-white/10" />
          {imageFile && !isEnlargedFormOpen && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Selected: {imageFile.name}</p>}
        </div>
        {error && <p className="text-red-500 text-sm py-2">Error: {error}</p>}
        {successMessage && <p className="text-green-500 text-sm py-2">{successMessage}</p>}
      </div>
    );
  };

  return (
    <>
      <Card className="p-4 dark:bg-gray-800 dark:border-white/10 shadow-md">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-md font-bold dark:text-gray-100 uppercase tracking-tight">Quick Upload News</h3>
          <Dialog open={isEnlargedFormOpen} onOpenChange={setIsEnlargedFormOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" title="Enlarge & Add Details" className="dark:border-white/10 dark:hover:bg-white/5">
                <Expand className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[90vw] max-w-[1000px] h-[auto] max-h-[90vh] flex flex-col p-0 dark:bg-gray-900 dark:border-white/10"> {/* Adjusted width, max-height and padding */}
              <DialogHeader className="px-6 py-4 border-b dark:border-white/10">
                <DialogTitle className="dark:text-gray-100">Upload News Article (Detailed)</DialogTitle>
              </DialogHeader>
              <div className="flex-grow overflow-y-auto p-6"> {/* Added padding to content area */}
                {renderFormFields(true)} {/* Pass true for two-column layout */}
              </div>
              <DialogFooter className="mt-auto px-6 py-4 border-t dark:border-white/10 bg-gray-50 dark:bg-gray-800/50 rounded-b-md"> {/* Styling footer */}
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="dark:border-white/10 dark:hover:bg-white/5">Cancel</Button>
                </DialogClose>
                <Button type="button" onClick={() => handleSubmit()} disabled={isLoading} className="bg-intranet-primary hover:bg-intranet-primary-dark text-white border-none">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Upload Article'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <form onSubmit={handleSubmit}>
          {renderFormFields(false)} {/* Pass false for original single-column layout */}
          <Button type="submit" disabled={isLoading} className="w-full mt-4 bg-intranet-primary hover:bg-intranet-primary-dark text-white border-none shadow-sm">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Upload Article'}
          </Button>
          {/* Error and success messages for the inline form are handled within renderFormFields */}
        </form>
      </Card>
    </>
  );
};

export default ScpngNewsUploadForm;