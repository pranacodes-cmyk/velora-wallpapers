import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  LogOut, Plus, Trash2, Image, FolderOpen, Diamond, Upload, X, Loader2, ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { ReorderDialog } from "@/components/ReorderDialog";
import DevicePremiumReset from "@/components/admin/DevicePremiumReset";


interface Category {
  id: string;
  name: string;
  slug: string;
  thumbnail_url: string | null;
  sort_order: number;
}

interface WallpaperRow {
  id: string;
  title: string;
  image_url: string;
  is_premium: boolean;
  category_id: string | null;
  sort_order: number;
}

export default function AdminDashboard() {
  const { user, isAdmin, loading: authLoading, signOut } = useAdmin();
  const navigate = useNavigate();

  const [tab, setTab] = useState<"wallpapers" | "categories">("wallpapers");
  const [categories, setCategories] = useState<Category[]>([]);
  const [wallpapers, setWallpapers] = useState<WallpaperRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Add wallpaper state
  const [showAdd, setShowAdd] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addCategory, setAddCategory] = useState("");
  const [addPremium, setAddPremium] = useState(false);
  const [addFile, setAddFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Add category state
  const [showAddCat, setShowAddCat] = useState(false);
  const [catName, setCatName] = useState("");

  // Reorder state
  const [reorderTarget, setReorderTarget] = useState<{
    type: "wallpaper" | "category";
    id: string;
    title: string;
    currentPos: number;
  } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [cRes, wRes] = await Promise.all([
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("wallpapers").select("*").order("sort_order"),
    ]);
    if (cRes.data) setCategories(cRes.data as Category[]);
    if (wRes.data) setWallpapers(wRes.data as WallpaperRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) navigate("/admin/login");
    if (!authLoading && user && !isAdmin) navigate("/admin/login");
  }, [authLoading, user, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin, fetchData]);

  // --- Wallpaper CRUD ---
  const handleAddWallpaper = async () => {
    if (!addFile || !addTitle || !addCategory) {
      toast.error("Fill all fields and select an image");
      return;
    }
    setUploading(true);
    const ext = addFile.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("wallpapers")
      .upload(path, addFile, { contentType: addFile.type });

    if (uploadError) {
      toast.error("Upload failed: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("wallpapers").getPublicUrl(path);

    const { error } = await supabase.from("wallpapers").insert({
      title: addTitle,
      category_id: addCategory,
      image_url: urlData.publicUrl,
      is_premium: addPremium,
      sort_order: wallpapers.length,
    });

    if (error) {
      toast.error("Failed: " + error.message);
    } else {
      toast.success("Wallpaper added!");
      setShowAdd(false);
      setAddTitle("");
      setAddFile(null);
      setAddPremium(false);
      fetchData();
    }
    setUploading(false);
  };

  const handleDeleteWallpaper = async (id: string) => {
    const { error } = await supabase.from("wallpapers").delete().eq("id", id);
    if (!error) {
      toast.success("Deleted");
      fetchData();
    }
  };

  // --- Category CRUD ---
  const handleAddCategory = async () => {
    if (!catName.trim()) return;
    const slug = catName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const { error } = await supabase.from("categories").insert({
      name: catName.trim(),
      slug,
      sort_order: categories.length,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Category added");
      setCatName("");
      setShowAddCat(false);
      fetchData();
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (!error) {
      toast.success("Category deleted");
      fetchData();
    }
  };

  // --- Reorder ---
  const handleReorder = async (newPos: number) => {
    if (!reorderTarget) return;
    const table = reorderTarget.type === "wallpaper" ? "wallpapers" : "categories";
    const { error } = await supabase
      .from(table)
      .update({ sort_order: newPos - 1 })
      .eq("id", reorderTarget.id);

    if (error) {
      toast.error("Reorder failed: " + error.message);
    } else {
      toast.success(`Moved to #${newPos}`);
      fetchData();
    }
    setReorderTarget(null);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const getCatName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name || "—";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </div>
        <button
          onClick={() => { signOut(); navigate("/admin/login"); }}
          className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center"
        >
          <LogOut className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-5 py-3 border-b border-border">
        <button
          onClick={() => setTab("wallpapers")}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
            tab === "wallpapers" ? "premium-gradient text-primary-foreground" : "bg-secondary text-secondary-foreground"
          }`}
        >
          <Image className="w-4 h-4" /> Wallpapers ({wallpapers.length})
        </button>
        <button
          onClick={() => setTab("categories")}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
            tab === "categories" ? "premium-gradient text-primary-foreground" : "bg-secondary text-secondary-foreground"
          }`}
        >
          <FolderOpen className="w-4 h-4" /> Categories ({categories.length})
        </button>
      </div>

      {/* Content */}
      <div className="p-4 pb-24 overflow-y-auto" style={{ maxHeight: "calc(100vh - 140px)" }}>
        <DevicePremiumReset />

        {tab === "wallpapers" && (
          <>
            <button
              onClick={() => setShowAdd(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-secondary text-foreground text-sm font-medium mb-4 active:scale-[0.98] transition-transform"
            >
              <Plus className="w-4 h-4" /> Add Wallpaper
            </button>

            <div className="grid grid-cols-3 gap-2">
              {wallpapers.map((w, idx) => (
                <div key={w.id} className="relative rounded-xl overflow-hidden group">
                  <img src={w.image_url} alt={w.title} className="w-full aspect-[3/4] object-cover" />
                  {/* Sort order badge */}
                  <div className="absolute top-1.5 left-1.5 min-w-[20px] h-5 px-1 rounded-md bg-background/80 backdrop-blur-sm flex items-center justify-center">
                    <span className="text-[9px] font-bold text-foreground">#{w.sort_order + 1}</span>
                  </div>
                  {/* Premium badge */}
                  {w.is_premium && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-secondary/80 flex items-center justify-center">
                      <Diamond className="w-2.5 h-2.5 text-primary" />
                    </div>
                  )}
                  {/* Hover overlay with info + actions */}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 gap-1">
                    <p className="text-[10px] font-medium text-foreground truncate">{w.title}</p>
                    <p className="text-[9px] text-muted-foreground">{getCatName(w.category_id)}</p>
                    <div className="flex gap-1 mt-1">
                      <button
                        onClick={() => setReorderTarget({ type: "wallpaper", id: w.id, title: w.title, currentPos: w.sort_order + 1 })}
                        className="w-6 h-6 rounded-full bg-secondary/90 flex items-center justify-center"
                      >
                        <ArrowUpDown className="w-3 h-3 text-foreground" />
                      </button>
                      <button
                        onClick={() => handleDeleteWallpaper(w.id)}
                        className="w-6 h-6 rounded-full bg-destructive/80 flex items-center justify-center"
                      >
                        <Trash2 className="w-3 h-3 text-destructive-foreground" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "categories" && (
          <>
            <button
              onClick={() => setShowAddCat(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-secondary text-foreground text-sm font-medium mb-4 active:scale-[0.98] transition-transform"
            >
              <Plus className="w-4 h-4" /> Add Category
            </button>

            <div className="space-y-2">
              {categories.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between px-4 py-3 rounded-2xl bg-secondary"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-muted-foreground min-w-[24px]">#{c.sort_order + 1}</span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground">/{c.slug}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setReorderTarget({ type: "category", id: c.id, title: c.name, currentPos: c.sort_order + 1 })}
                      className="w-8 h-8 rounded-full bg-background/50 flex items-center justify-center"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5 text-foreground" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(c.id)}
                      className="w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Reorder Dialog */}
      <ReorderDialog
        open={!!reorderTarget}
        title={reorderTarget?.title || ""}
        currentPos={reorderTarget?.currentPos || 0}
        onConfirm={handleReorder}
        onCancel={() => setReorderTarget(null)}
      />

      {/* Add Wallpaper Modal */}
      <AnimatePresence>
        {showAdd && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-background/70 backdrop-blur-md"
              onClick={() => setShowAdd(false)}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 32 }}
              className="fixed bottom-0 left-0 right-0 z-[60] bg-card rounded-t-3xl p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-foreground">Add Wallpaper</h2>
                <button onClick={() => setShowAdd(false)} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-3">
                <input
                  placeholder="Title"
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-secondary text-foreground placeholder:text-muted-foreground text-sm focus:outline-none"
                />
                <select
                  value={addCategory}
                  onChange={(e) => setAddCategory(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-secondary text-foreground text-sm focus:outline-none appearance-none"
                >
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <label className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addPremium}
                    onChange={(e) => setAddPremium(e.target.checked)}
                    className="accent-primary"
                  />
                  <span className="text-sm text-foreground flex items-center gap-2">
                    <Diamond className="w-3.5 h-3.5 text-primary" /> Premium wallpaper
                  </span>
                </label>

                <label className="flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed border-border cursor-pointer hover:border-primary/50 transition-colors">
                  <Upload className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {addFile ? addFile.name : "Select image"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setAddFile(e.target.files?.[0] || null)}
                  />
                </label>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleAddWallpaper}
                  disabled={uploading}
                  className="w-full py-3.5 rounded-full premium-gradient text-primary-foreground font-bold text-sm disabled:opacity-50"
                >
                  {uploading ? "Uploading..." : "Add Wallpaper"}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add Category Modal */}
      <AnimatePresence>
        {showAddCat && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-background/70 backdrop-blur-md"
              onClick={() => setShowAddCat(false)}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 32 }}
              className="fixed bottom-0 left-0 right-0 z-[60] bg-card rounded-t-3xl p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-foreground">Add Category</h2>
                <button onClick={() => setShowAddCat(false)} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <div className="space-y-3">
                <input
                  placeholder="Category name"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-secondary text-foreground placeholder:text-muted-foreground text-sm focus:outline-none"
                />
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleAddCategory}
                  className="w-full py-3.5 rounded-full premium-gradient text-primary-foreground font-bold text-sm"
                >
                  Add Category
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
