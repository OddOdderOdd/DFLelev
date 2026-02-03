import FileExplorer from '../components/FileExplorer/FileExplorer';
import { useAdmin } from '../context/AdminContext';

export default function Arkiv() {
  const { isAdmin } = useAdmin();

  return (
    <div className="bg-slate-50">
      <div className="container mx-auto px-4 py-12">
        <div className="mb-10 flex flex-col gap-4">
          <h1 className="text-4xl font-bold text-slate-900">Arkiv</h1>
          <p className="max-w-2xl text-lg text-slate-600">
            Arkivet viser filer fra din lokale mappe. Når du er i admin mode, kan du oprette
            mapper, uploade filer og vedligeholde arkivet direkte herfra.
          </p>
        </div>

        {isAdmin ? (
          <FileExplorer
            title="Admin: Arkiv"
            description="Lokalt arkiv (public/arkiv) med dokumenter, billeder og video."
            baseDirectory="arkiv"
            uploadAccept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
            emptyMessage="Ingen arkivfiler endnu."
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-slate-500">
            Aktiver admin mode for at se arkivets filstruktur.
          </div>
        )}
      </div>
    </div>
  );
}
