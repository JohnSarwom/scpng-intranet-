// News.tsx

import React, { useState, useMemo } from 'react';
import PageLayout from '@/components/layout/PageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

import { supabase, logger } from '@/lib/supabaseClient';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TradingViewTicker from '@/components/custom/TradingViewTicker';
import ScpngNewsUploadForm from '@/components/custom/ScpngNewsUploadForm';
import ScpngArticleModal, { NewsArticle as ModalNewsArticle } from '@/components/custom/ScpngArticleModal';
import { useMicrosoftGraph } from '@/hooks/useMicrosoftGraph';
import { NewsSharePointService } from '@/services/newsSharePointService';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import NewsDashboard from '@/components/dashboard/NewsDashboard';
import { PageNewsArticle } from '@/types/news';
import { ArticleGridSkeleton } from '@/components/custom/ArticleGridSkeleton';
import { NewsDashboardSkeleton } from '@/components/dashboard/NewsDashboardSkeleton';

// Mock news data (rest of your code)
const mockNewsData = [
  // SCPNG News item removed, will be fetched from Supabase
  {
    id: 'mock-2',
    title: 'New HR Policy Announced',
    summary: 'Details about the new remote work policy have been released.',
    date: 'May 18, 2023',
    category: 'HR', // Example category for My Feed
    important: false,
    sourceName: 'HR Department',
    sourceUrl: '#',
    urlToImage: 'https://picsum.photos/seed/hr-policy/800/400',
  },
  {
    id: 'mock-3',
    title: 'IT System Maintenance Alert',
    summary: 'Scheduled maintenance for core IT infrastructure this weekend.',
    date: 'May 15, 2023',
    category: 'IT', // Example category for My Feed
    important: true,
    sourceName: 'IT Department',
    sourceUrl: '#',
    urlToImage: 'https://picsum.photos/seed/it-maintenance/800/400',
  },
  {
    id: 'mock-4', // Corrected ID
    title: 'Community Engagement Initiative',
    summary: 'Join us for the upcoming community tree planting event next Saturday.',
    date: 'May 10, 2023',
    category: 'Organization', // Example category for My Feed
    important: false,
    sourceName: 'Community Outreach',
    sourceUrl: '#',
    urlToImage: 'https://picsum.photos/seed/community-event/800/400',
  }
];

// This interface is used internally for structuring data in News.tsx tabs
// This interface is used internally for structuring data in News.tsx tabs
// PageNewsArticle is now imported from @/types/news


interface NewsTabState {
  articles: PageNewsArticle[]; // Use PageNewsArticle for tab state
  isLoading: boolean;
  error: string | null;
  hasFetched: boolean;
  promptUsed?: string | null;
}

// Initial base categories
const baseNewsCategories = ['News Dashboard', 'SCPNG News', 'National News', 'Global Insights', 'All News'];
const aiDrivenCategories = [] as string[];

// Define ArticleCardComponent locally within News.tsx
const ArticleCardComponent: React.FC<{ article: PageNewsArticle; handleReadMoreClick: (article: PageNewsArticle) => void }> = ({ article, handleReadMoreClick }) => {
  return (
    <Card key={article.id} className={`overflow-hidden flex flex-col justify-between`}>
      {article.urlToImage && (
        <img
          src={article.urlToImage}
          alt={`Image for ${article.title}`}
          className="w-full h-48 object-cover"
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
      )}
      <div>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start mb-1">
            <span className="inline-block text-xs font-medium bg-gray-100 dark:bg-gray-700 dark:text-gray-200 rounded px-2 py-1">
              {article.category}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{article.date}</span>
          </div>
          <CardTitle className="text-lg leading-tight hover:text-intranet-primary transition-colors dark:text-white dark:hover:text-intranet-accent-light">
            {article.sourceUrl && !article.sourceUrl.startsWith('#article-') && article.sourceUrl !== '#' ? (
              <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {article.title}
              </a>
            ) : (
              article.title
            )}
          </CardTitle>
          {article.sourceName && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Source: {article.sourceName}</p>
          )}
        </CardHeader>
        <CardContent className="pt-0 pb-3">
          <p className="text-gray-600 dark:text-gray-300 text-sm line-clamp-4 hover:line-clamp-none transition-all duration-300 ease-in-out">{article.summary}</p>
        </CardContent>
      </div>
      <div className="px-6 pb-4 pt-2">
        <Button
          variant="link"
          className="p-0 text-intranet-accent hover:text-intranet-accent-dark dark:hover:text-intranet-accent-light"
          onClick={() => handleReadMoreClick(article)}
        >
          Read more →
        </Button>
      </div>
    </Card>
  );
};

const News = () => {
  const { session } = useSupabaseAuth();
  const { hasPermission, isAdmin } = useRoleBasedAuth();

  const canUploadNews = hasPermission('news', 'upload');
  const isSystemAdmin = isAdmin;

  const [selectedScpngYear, setSelectedScpngYear] = useState<string>('All');

  const newsCategories = baseNewsCategories;

  // State for the Article Modal - RESTORED
  const [selectedArticleForModal, setSelectedArticleForModal] = useState<ModalNewsArticle | null>(null);
  const [isArticleModalOpen, setIsArticleModalOpen] = useState(false);

  const [isInvokingEdgeFunction, setIsInvokingEdgeFunction] = useState(false);
  const queryClient = useQueryClient();

  // Handler to open the modal with the selected article
  const handleReadMoreClick = (article: PageNewsArticle) => {
    // Map PageNewsArticle to ModalNewsArticle
    const modalArticleData: ModalNewsArticle = {
      article_id: article.article_id_internal, // Ensure this is correctly mapped
      title: article.title,
      description: article.description_full || article.summary, // Prefer full description
      published_at: article.published_at_iso || new Date(article.date).toISOString(), // Ensure ISO string
      source_name: article.sourceName,
      url: article.sourceUrl,
      url_to_image: article.urlToImage,
      categories_api: typeof article.categoriesApi === 'string' ? article.categoriesApi : JSON.stringify(article.categoriesApi || []),
    };
    setSelectedArticleForModal(modalArticleData);
    setIsArticleModalOpen(true);
  };


  // --- Fetch all news from SharePoint via React Query (cached + persistent) ---
  const { getClient } = useMicrosoftGraph();

  const { data: allFormattedArticles = [], isLoading: newsLoading, error: newsError, refetch: refetchNews } = useQuery({
    queryKey: ['sharePointNews'],
    queryFn: async () => {
      const graphClient = await getClient();
      if (!graphClient) return [];

      const service = new NewsSharePointService(graphClient);
      const data = await service.getAllNews();

      return data.map((article) => {
        let displayCategory = 'General';
        const categoryLower = article.category.toLowerCase();
        const countryUpper = article.country?.toUpperCase() || '';

        if (categoryLower.includes('scpng') || categoryLower.includes('internal')) {
          displayCategory = 'SCPNG News';
        } else if (countryUpper === 'PAPUA NEW GUINEA') {
          displayCategory = 'National News';
        } else {
          displayCategory = 'Global Insights';
        }

        return {
          id: article.id,
          article_id_internal: article.articleId,
          title: article.title,
          summary: article.aiSummary || (article.description ? (article.description.length > 150 ? article.description.substring(0, 150) + '...' : article.description) : 'No summary available.'),
          description_full: article.description,
          date: article.publishDate ? new Date(article.publishDate).toLocaleDateString('en-CA') : new Date().toLocaleDateString('en-CA'),
          published_at_iso: article.publishDate,
          category: displayCategory,
          important: false,
          sourceName: article.sourceName,
          sourceUrl: article.sourceUrl,
          urlToImage: article.imageUrl,
          categoriesApi: article.category,
          aiSummary: article.aiSummary,
          country: article.country,
        } as PageNewsArticle;
      });
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Derive categorized news from the cached data
  const shuffledAllNews = useMemo(() => {
    const newArray = [...allFormattedArticles];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }, [allFormattedArticles]);

  const scpngNewsArticles = useMemo(() =>
    allFormattedArticles.filter(a => {
      const cat = (a.categoriesApi as string || '').toLowerCase();
      return cat.includes('scpng') || cat.includes('internal');
    }), [allFormattedArticles]);

  const nationalNewsArticles = useMemo(() =>
    allFormattedArticles.filter(a =>
      (a.country || '').toUpperCase() === 'PAPUA NEW GUINEA' &&
      a.category !== 'SCPNG News'
    ), [allFormattedArticles]);

  const globalNewsArticles = useMemo(() =>
    allFormattedArticles.filter(a => (a.country || '').toUpperCase() !== 'PAPUA NEW GUINEA'),
    [allFormattedArticles]);

  const availableScpngYears = useMemo(() =>
    [...new Set(scpngNewsArticles.map(article => new Date(article.date).getFullYear().toString()))]
      .sort((a, b) => parseInt(b) - parseInt(a)),
    [scpngNewsArticles]);

  // Legacy compat: build newsData shape for renderNewsCards
  const newsData = useMemo(() => {
    const errorMsg = newsError ? (newsError as Error).message : null;
    return {
      'News Dashboard': { articles: [] as PageNewsArticle[], isLoading: newsLoading, error: errorMsg, hasFetched: !newsLoading },
      'All News': { articles: shuffledAllNews, isLoading: newsLoading, error: errorMsg, hasFetched: !newsLoading },
      'SCPNG News': { articles: scpngNewsArticles, isLoading: newsLoading, error: errorMsg, hasFetched: !newsLoading },
      'National News': { articles: nationalNewsArticles, isLoading: newsLoading, error: errorMsg, hasFetched: !newsLoading },
      'Global Insights': { articles: globalNewsArticles, isLoading: newsLoading, error: errorMsg, hasFetched: !newsLoading },
    } as Record<string, NewsTabState>;
  }, [shuffledAllNews, scpngNewsArticles, nationalNewsArticles, globalNewsArticles, newsLoading, newsError]);

  const fetchSharePointNews = () => { refetchNews(); };

  // --- AMENDED SECTION: Use supabase.functions.invoke() ---
  const handleInvokeEdgeFunction = async () => {
    setIsInvokingEdgeFunction(true);
    // logger.info('[News] Manually invoking Edge Function via supabase.functions.invoke()...');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('update-all-news-from-sources', {
        method: 'POST',
        body: {},
      });

      if (invokeError) {
        logger.error('[News] Edge Function "update-all-news-from-sources" invocation failed:', {
          message: invokeError.message,
          status: invokeError.status,
        });
      } else {
        // logger.success('[News] Edge Function "update-all-news-from-sources" invoked successfully:', data);
      }
    } catch (err: any) {
      logger.error('[News] Caught unexpected error during Edge Function invocation:', err.message);
    } finally {
      setIsInvokingEdgeFunction(false);
      // logger.info('[News] Re-fetching "All News" from Supabase table after "update-all-news-from-sources" Edge Function invocation attempt.');
      fetchSharePointNews();
    }
  };
  // --- END AMENDED SECTION ---



  const renderNewsCards = (category?: string) => {
    const tabKey = category && newsData[category] ? category : 'All News';
    const currentTabState = newsData[tabKey];

    if (currentTabState?.isLoading && !currentTabState?.hasFetched) {
      if (category === 'News Dashboard') {
        return <NewsDashboardSkeleton />;
      }
      return (
        <div className="mt-4">
          <ArticleGridSkeleton count={6} />
        </div>
      );
    }

    if (currentTabState?.error) {
      return <p className="text-red-500">Error loading news: {currentTabState.error}</p>;
    }

    let articlesToDisplay = currentTabState?.articles || [];

    if (category === 'News Dashboard') {
      return (
        <NewsDashboard
          allNews={newsData['All News']?.articles || []}
          scpngNews={newsData['SCPNG News']?.articles || []}
          nationalNews={newsData['National News']?.articles || []}
          globalNews={newsData['Global Insights']?.articles || []}
          onReadMore={handleReadMoreClick}
        />
      );
    }

    if (category === 'SCPNG News') {
      if (selectedScpngYear !== 'All') {
        articlesToDisplay = articlesToDisplay.filter(article =>
          new Date(article.date).getFullYear().toString() === selectedScpngYear
        );
      }

      const renderedArticleCards = articlesToDisplay.map((item) =>
        <ArticleCardComponent article={item} handleReadMoreClick={handleReadMoreClick} key={item.id} />
      );

      return (
        <div>
          {/* Year Filter Buttons for SCPNG News */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              variant={selectedScpngYear === 'All' ? 'default' : 'outline'}
              onClick={() => setSelectedScpngYear('All')}
              size="sm"
            >
              All Years
            </Button>
            {availableScpngYears.map(year => (
              <Button
                key={year}
                variant={selectedScpngYear === year ? 'default' : 'outline'}
                onClick={() => setSelectedScpngYear(year)}
                size="sm"
              >
                {year}
              </Button>
            ))}
          </div>

          {/* Existing layout logic based on canUploadNews */}
          {canUploadNews ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-4">
                {articlesToDisplay.length > 0
                  ? renderedArticleCards
                  : (<p className="text-gray-600 dark:text-gray-400">No SCPNG news articles found {selectedScpngYear !== 'All' ? `for ${selectedScpngYear}` : ''}. Use the form to add new ones.</p>)}
              </div>
              <div className="md:col-span-1">
                <h3 className="text-lg font-semibold mb-3 dark:text-white">Upload SCPNG News Article</h3>
                <ScpngNewsUploadForm onUploadSuccess={fetchSharePointNews} />
              </div>
            </div>
          ) : (
            articlesToDisplay.length > 0
              ? (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{renderedArticleCards}</div>)
              : (<p className="text-gray-600 dark:text-gray-400">No SCPNG news articles found {selectedScpngYear !== 'All' ? `for ${selectedScpngYear}` : ''}.</p>)
          )}
        </div>
      );
    }

    // Fallback for other categories (National News, Global Insights, etc.)
    const otherCategoryArticles = articlesToDisplay.map((item) =>
      <ArticleCardComponent article={item} handleReadMoreClick={handleReadMoreClick} key={item.id} />
    );
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {otherCategoryArticles.length > 0
          ? otherCategoryArticles
          : (<p className="text-gray-600 dark:text-gray-400">No news articles available for this category yet.</p>)}
      </div>
    );
  };

  return (
    <PageLayout>
      <div className="mb-6">
        <div className="flex items-center justify-between"> {/* Flex container for title and ticker */}
          <div className="flex-shrink-0 mr-4"> {/* Container for title to prevent it from shrinking too much */}
            <h1 className="text-2xl font-bold">News & Announcements</h1>
          </div>
          <div className="flex-grow min-w-0"> {/* Container for ticker to allow it to grow and handle overflow */}
            <TradingViewTicker />
          </div>
        </div>
        {/* The subtitle can remain below or be adjusted if needed */}
        <p className="text-gray-500 mt-2">Stay updated with the latest organizational news and unit announcements</p>
      </div>

      <Tabs defaultValue="News Dashboard" className="w-full">
        <TabsList>
          {newsCategories.map(category => (
            <TabsTrigger key={category} value={category}>
              {category}
            </TabsTrigger>
          ))}
        </TabsList>

        {newsCategories.map(category => (
          <TabsContent key={category} value={category} className="mt-6 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            {renderNewsCards(category)}
          </TabsContent>
        ))}
      </Tabs>

      {/* Recent Updates removed as it is now part of the dashboard */}

      {/* Render the Modal */}
      <ScpngArticleModal
        article={selectedArticleForModal}
        isOpen={isArticleModalOpen}
        onOpenChange={setIsArticleModalOpen}
      />
    </PageLayout>
  );
};

export default News;
