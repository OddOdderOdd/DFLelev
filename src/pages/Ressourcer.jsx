import { useEffect, useMemo, useState } from 'react';
import { TinaMarkdown } from 'tinacms/dist/rich-text';
import { DELETE_RESOURCE_MUTATION, RESOURCES_QUERY, tinaClient } from '../tina/client';
import FileExplorer from '../components/FileExplorer/FileExplorer';
import { useAdmin } from '../context/AdminContext';

const TYPE_STYLES = {
  Document: {
    badge: 'bg-blue-100 text-blue-700',
    icon: '📄',
  },
  Video: {
    badge: 'bg-rose-100 text-rose-700',
    icon: '🎬',
  },
  Link: {
    badge: 'bg-emerald-100 text-emerald-700',
    icon: '🔗',
  },
};

const getVideoEmbedUrl = (url) => {
  if (!url) return '';
  const youtubeMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/
  );
  if (youtubeMatch?.[1]) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  }
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch?.[1]) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }
  return url;
};

const withBaseUrl = (path) => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const base = import.meta.env.BASE_URL || '/';
  return `${base}${path.replace(/^\/+/, '')}`;
};

const getResourceHref = (resource) => {
  if (resource.type === 'Document') {
    return withBaseUrl(resource.file);
  }
  if (resource.type === 'Link') {
    return withBaseUrl(resource.file || resource.videoUrl);
  }
  return '';
};

export default function Ressourcer() {
  const { isAdmin } = useAdmin();
  const [resources, setResources] = useState([]);
  const [status, setStatus] = useState('loading');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [deleteStatus, setDeleteStatus] = useState(null);

  const handleDeleteResource = async (resource) => {
    if (!resource?._sys?.relativePath) return;
    setDeleteStatus(resource.id);
    try {
      await tinaClient.request({
        query: DELETE_RESOURCE_MUTATION,
        variables: { relativePath: resource._sys.relativePath },
      });
      setResources((prev) => prev.filter((item) => item.id !== resource.id));
    } catch (error) {
      console.error('Failed to delete resource', error);
    } finally {
      setDeleteStatus(null);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const fetchResources = async () => {
      try {
        const response = await tinaClient.request({ query: RESOURCES_QUERY });
        const edges = response?.data?.resourcesConnection?.edges || [];
        if (!isMounted) return;
        setResources(edges.map((edge) => edge.node));
        setStatus('success');
      } catch (error) {
        console.error('Failed to load resources from TinaCMS', error);
        if (!isMounted) return;
        setStatus('error');
      }
    };

    fetchResources();

    return () => {
      isMounted = false;
    };
  }, []);

  const resourceCards = useMemo(() => {
    return resources.map((resource) => {
      const typeStyles = TYPE_STYLES[resource.type] || TYPE_STYLES.Document;
      const href = getResourceHref(resource);
      const isActionDisabled = resource.type !== 'Video' && !href;

      return (
        <article
          key={resource.id}
          className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
        >
          <div className="relative h-44 w-full bg-slate-100">
            {resource.thumbnail ? (
              <img
                src={resource.thumbnail}
                alt={resource.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-4xl">
                {typeStyles.icon}
              </div>
            )}
            <span
              className={`absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-semibold ${typeStyles.badge}`}
            >
              {resource.type}
            </span>
          </div>

          <div className="flex flex-1 flex-col gap-3 px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{resource.title}</h2>
            </div>

            {resource.description && (
              <div className="prose prose-sm max-h-24 max-w-none overflow-hidden text-slate-600">
                <TinaMarkdown content={resource.description} />
              </div>
            )}

            <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="text-sm text-slate-500">{typeStyles.icon}</div>

              <div className="flex flex-wrap items-center gap-3">
                {resource.type === 'Video' ? (
                  <button
                    type="button"
                    onClick={() => setSelectedVideo(resource)}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Afspil
                  </button>
                ) : (
                  <a
                    href={href || undefined}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      isActionDisabled
                        ? 'cursor-not-allowed border-slate-200 text-slate-400'
                        : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:text-slate-900'
                    }`}
                    target={resource.type === 'Link' ? '_blank' : undefined}
                    rel={resource.type === 'Link' ? 'noreferrer' : undefined}
                    onClick={(event) => {
                      if (isActionDisabled) {
                        event.preventDefault();
                      }
                    }}
                  >
                    Åbn
                  </a>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleDeleteResource(resource)}
                    disabled={deleteStatus === resource.id}
                    className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:border-rose-300 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deleteStatus === resource.id ? 'Sletter...' : 'Slet'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </article>
      );
    });
  }, [resources, isAdmin, deleteStatus]);

  return (
    <div className="bg-slate-50">
      <div className="container mx-auto px-4 py-12">
        <div className="mb-10 flex flex-col gap-4">
          <h1 className="text-4xl font-bold text-slate-900">Ressourcer</h1>
          <p className="max-w-2xl text-lg text-slate-600">
            Find guides, dokumenter og videoer samlet ét sted. Alt indholdet styres direkte fra
            TinaCMS, så strukturen matcher dine mapper.
          </p>
        </div>

        {isAdmin && (
          <div className="mb-10">
            <FileExplorer
              title="Admin: Ressourcer"
              description="Administrer dokumenter og billeder i TinaCMS."
              baseDirectory="uploads"
              uploadAccept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
              emptyMessage="Ingen ressourcer i filsystemet endnu."
            />
          </div>
        )}

        {status === 'loading' && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-slate-500">
            Henter ressourcer...
          </div>
        )}

        {status === 'error' && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-10 text-center text-rose-700">
            Kunne ikke hente ressourcer. Tjek TinaCMS-konfigurationen og prøv igen.
          </div>
        )}

        {status === 'success' && resources.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-slate-500">
            Ingen ressourcer endnu. Opret indhold i TinaCMS for at komme i gang.
          </div>
        )}

        {resources.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{resourceCards}</div>
        )}
      </div>

      {selectedVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4">
          <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-black shadow-2xl">
            <button
              type="button"
              onClick={() => setSelectedVideo(null)}
              className="absolute right-4 top-4 z-10 rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-slate-900 transition hover:bg-white"
            >
              Luk
            </button>
            <div className="aspect-video w-full">
              <iframe
                title={selectedVideo.title}
                src={getVideoEmbedUrl(selectedVideo.videoUrl)}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="bg-white px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">{selectedVideo.title}</h2>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
