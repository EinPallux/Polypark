"use client";

/**
 * Thumbnail stage: renders one catalog piece centered for scripts/gen-thumbnails.ts
 * (?id=<pieceId>), or an index of all pieces for manual QA. Dev tooling — not
 * linked from any menu.
 */
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Canvas } from "@react-three/fiber";
import { Bounds, Clone, useGLTF } from "@react-three/drei";
import { parseCatalog, type Catalog } from "@/content/schema";

function useCatalog(): Catalog | null {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  useEffect(() => {
    void fetch("/content/catalog.json")
      .then((response) => response.json())
      .then((json: unknown) => setCatalog(parseCatalog(json)))
      .catch(() => setCatalog(null));
  }, []);
  return catalog;
}

function PieceModel({ file, onReady }: { file: string; onReady: () => void }) {
  const { scene } = useGLTF(`/${file}`);
  useEffect(() => {
    onReady();
  }, [onReady]);
  return <Clone object={scene} />;
}

function ThumbStage() {
  const params = useSearchParams();
  const id = params.get("id");
  const catalog = useCatalog();
  const [ready, setReady] = useState(false);

  if (!catalog) {
    return <p className="p-4 font-ui text-sm">loading catalog…</p>;
  }

  if (!id) {
    return (
      <ul className="grid grid-cols-3 gap-1 p-4 font-ui text-sm">
        {catalog.pieces.map((piece) => (
          <li key={piece.id}>
            <Link className="text-sky-500 underline" href={`/dev/thumbs?id=${encodeURIComponent(piece.id)}`}>
              {piece.id}
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  const piece = catalog.pieces.find((candidate) => candidate.id === id);
  if (!piece) {
    return <p className="p-4 font-ui text-sm text-danger-500">unknown piece: {id}</p>;
  }

  return (
    <div
      data-thumb-stage
      {...(ready ? { "data-thumb-ready": "true" } : {})}
      className="h-64 w-64 bg-frost-200"
    >
      <Canvas dpr={1} camera={{ position: [1.6, 1.3, 1.6], fov: 32 }} frameloop="demand">
        <hemisphereLight args={["#dff0ff", "#7aa05f", 1.1]} />
        <directionalLight position={[3, 5, 2]} intensity={1.4} color="#fff2dc" />
        <Suspense fallback={null}>
          <Bounds fit clip margin={1.15}>
            <PieceModel file={piece.file} onReady={() => setReady(true)} />
          </Bounds>
        </Suspense>
      </Canvas>
    </div>
  );
}

export default function ThumbsPage() {
  return (
    <Suspense fallback={null}>
      <ThumbStage />
    </Suspense>
  );
}
