"use client";

import { useCallback, useMemo, useState } from "react";
import imageCompression from "browser-image-compression";
import Cropper, { type Area } from "react-easy-crop";
import {
  AlertCircle,
  CheckCircle2,
  Layers,
  LayoutGrid,
  Minus,
  PauseCircle,
  Search,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import type * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { AdminMenuItem, MenuCategory } from "@/types/menu";

type MenuFormState = {
  id: string | null;
  name: string;
  category: MenuCategory;
  price: string;
  imageUrl: string;
  isAvailable: boolean;
};

type MenuPerformance = {
  item: string;
  orders: number;
  rating: number;
  revenue: number;
};

type MenuSignal = {
  label: string;
  orders: number;
  rating: number;
  revenue: number;
  tone: "strong" | "steady" | "watch" | "muted";
};

const emptyMenuForm: MenuFormState = {
  id: null,
  name: "",
  category: "non-coffee",
  price: "",
  imageUrl: "",
  isAvailable: true,
};

const adminMenuCategories: Array<{ value: MenuCategory; label: string }> = [
  { value: "coffee", label: "Coffee" },
  { value: "non-coffee", label: "Non-Coffee" },
  { value: "pastries", label: "Pastries" },
  { value: "latte-series", label: "Latte Series" },
  { value: "premium-blends", label: "Premium Blends" },
  { value: "best-deals", label: "Best Deals" },
];

const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
const maxInitialImageSize = 10 * 1024 * 1024;
const maxCompressedImageSize = 1.5 * 1024 * 1024;
const compressionOptions = {
  maxSizeMB: 1.45,
  maxWidthOrHeight: 1400,
  useWebWorker: true,
  fileType: "image/webp",
  initialQuality: 0.88,
};

function peso(value: number) {
  return `\u20B1${Math.round(value).toLocaleString("en-PH")}`;
}

function formatCategory(category: string) {
  if (category === "coffee") return "Coffee";
  if (category === "non-coffee") return "Non-Coffee";
  if (category === "latte-series") return "Latte Series";
  if (category === "premium-blends") return "Premium Blends";
  if (category === "best-deals") return "Best Deals";

  return category
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-[18px] border border-dashed border-[#D8C8AA] bg-[#FFF8EF] px-4 py-8 text-center font-sans text-sm text-[#8C7A64]">
      {label}
    </div>
  );
}

function getMenuSignal(
  item: AdminMenuItem,
  performance: MenuPerformance | undefined,
  maxOrders: number
): MenuSignal {
  if (!item.isAvailable) {
    return {
      label: "Paused",
      orders: performance?.orders ?? 0,
      rating: performance?.rating ?? 0,
      revenue: performance?.revenue ?? 0,
      tone: "muted",
    };
  }

  const orders = performance?.orders ?? 0;
  const rating = performance?.rating ?? 0;
  const revenue = performance?.revenue ?? 0;
  const orderRatio = maxOrders > 0 ? orders / maxOrders : 0;

  if (orders === 0) {
    return { label: "Untested", orders, rating, revenue, tone: "watch" };
  }

  if (orderRatio >= 0.7 || rating >= 4.5) {
    return { label: "High Signal", orders, rating, revenue, tone: "strong" };
  }

  if (orderRatio >= 0.3 || rating >= 4) {
    return { label: "Steady", orders, rating, revenue, tone: "steady" };
  }

  return { label: "Review", orders, rating, revenue, tone: "watch" };
}

function SignalChip({ signal }: { signal: MenuSignal }) {
  const classes = {
    strong: "bg-[#E6F2E8] text-[#0F441D]",
    steady: "bg-[#FFF8EF] text-[#684B35]",
    watch: "bg-[#FFF1EC] text-[#9C543D]",
    muted: "bg-[#FFFCF7] text-[#8C7A64] border border-[#DCCFB8]",
  };
  const icons = {
    strong: TrendingUp,
    steady: Minus,
    watch: AlertCircle,
    muted: PauseCircle,
  };
  const Icon = icons[signal.tone];

  return (
    <span
      className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 font-sans text-xs font-semibold ${classes[signal.tone]}`}
    >
      <Icon size={12} />
      {signal.label}
    </span>
  );
}

function loadImage(imageUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();

    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () =>
      reject(new Error("Could not read the selected image."))
    );
    image.src = imageUrl;
  });
}

async function getCroppedImageFile(imageUrl: string, cropArea: Area) {
  const image = await loadImage(imageUrl);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not prepare the cropped image.");
  }

  canvas.width = cropArea.width;
  canvas.height = cropArea.height;

  // Use Math.round to ensure we are drawing from exact pixel coordinates
  context.drawImage(
    image,
    Math.round(cropArea.x),
    Math.round(cropArea.y),
    Math.round(cropArea.width),
    Math.round(cropArea.height),
    0,
    0,
    Math.round(cropArea.width),
    Math.round(cropArea.height)
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.92)
  );

  if (!blob) {
    throw new Error("Could not save the cropped image.");
  }

  return new File([blob], "menu-image.webp", { type: "image/webp" });
}

export function MenuView({
  itemPerformance,
  menuItems,
  setMenuItems,
}: {
  itemPerformance: MenuPerformance[];
  menuItems: AdminMenuItem[];
  setMenuItems: React.Dispatch<React.SetStateAction<AdminMenuItem[]>>;
}) {
  const [form, setForm] = useState<MenuFormState>(emptyMenuForm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [menuMessage, setMenuMessage] = useState("");
  const [menuError, setMenuError] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState("");
  const [cropSourceFile, setCropSourceFile] = useState<File | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeletingItem, setIsDeletingItem] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<AdminMenuItem | null>(null);
  const [menuSearch, setMenuSearch] = useState("");
  const [menuCategoryFilter, setMenuCategoryFilter] = useState("all");
  const performanceByName = useMemo(
    () =>
      new Map(
        itemPerformance.map((item) => [item.item.trim().toLowerCase(), item])
      ),
    [itemPerformance]
  );
  const maxPerformanceOrders = Math.max(
    1,
    ...itemPerformance.map((item) => item.orders)
  );
  const menuSignals = useMemo(
    () =>
      new Map(
        menuItems.map((item) => [
          item.id,
          getMenuSignal(
            item,
            performanceByName.get(item.name.trim().toLowerCase()),
            maxPerformanceOrders
          ),
        ])
      ),
    [maxPerformanceOrders, menuItems, performanceByName]
  );
  const menuIntelligence = useMemo(() => {
    const availableItems = menuItems.filter((item) => item.isAvailable);
    const categoryStats = adminMenuCategories
      .map((category) => {
        const categoryItems = menuItems.filter(
          (item) => item.category === category.value
        );
        const signals = categoryItems.map(
          (item) => menuSignals.get(item.id) ?? getMenuSignal(item, undefined, 1)
        );

        return {
          label: category.label,
          available: categoryItems.filter((item) => item.isAvailable).length,
          orders: signals.reduce((sum, signal) => sum + signal.orders, 0),
          revenue: signals.reduce((sum, signal) => sum + signal.revenue, 0),
        };
      })
      .sort((first, second) => second.orders - first.orders);
    const strongestCategory = categoryStats[0];
    const recommendationCandidate = [...menuItems]
      .filter((item) => item.isAvailable)
      .map((item) => ({
        item,
        signal: menuSignals.get(item.id) ?? getMenuSignal(item, undefined, 1),
      }))
      .sort(
        (first, second) =>
          second.signal.orders * 2 +
          second.signal.rating * 10 -
          (first.signal.orders * 2 + first.signal.rating * 10)
      )[0];
    const reviewCandidate = [...menuItems]
      .filter((item) => item.isAvailable)
      .map((item) => ({
        item,
        signal: menuSignals.get(item.id) ?? getMenuSignal(item, undefined, 1),
      }))
      .sort(
        (first, second) =>
          first.signal.orders - second.signal.orders ||
          first.signal.rating - second.signal.rating
      )[0];

    return {
      availableCount: availableItems.length,
      categoryCount: categoryStats.filter((category) => category.available > 0).length,
      recommendationCandidate,
      reviewCandidate,
      strongestCategory,
    };
  }, [menuItems, menuSignals]);

  const filteredMenuItems = useMemo(() => {
    const keyword = menuSearch.trim().toLowerCase();

    return menuItems.filter((item) => {
      const matchesCategory =
        menuCategoryFilter === "all" || item.category === menuCategoryFilter;
      const matchesSearch =
        !keyword ||
        item.name.toLowerCase().includes(keyword) ||
        formatCategory(item.category).toLowerCase().includes(keyword);

      return matchesCategory && matchesSearch;
    });
  }, [menuCategoryFilter, menuItems, menuSearch]);

  const menuFilterOptions = [
    { value: "all", label: "All", count: menuItems.length },
    ...adminMenuCategories.map((category) => ({
      ...category,
      count: menuItems.filter((item) => item.category === category.value)
        .length,
    })),
  ];

  function openCreateForm() {
    setForm(emptyMenuForm);
    setMenuMessage("");
    setMenuError("");
    setIsFormOpen(true);
  }

  function openEditForm(item: AdminMenuItem) {
    setForm({
      id: item.id,
      name: item.name,
      category: item.category,
      price: String(item.price),
      imageUrl: item.imageUrl ?? "",
      isAvailable: item.isAvailable,
    });
    setMenuMessage("");
    setMenuError("");
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setForm(emptyMenuForm);
    closeCropModal();
  }

  function closeCropModal() {
    if (cropImageUrl) {
      URL.revokeObjectURL(cropImageUrl);
    }

    setCropImageUrl("");
    setCropSourceFile(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }

  const handleCropComplete = useCallback(
    (_croppedArea: Area, nextCroppedAreaPixels: Area) => {
      setCroppedAreaPixels(nextCroppedAreaPixels);
    },
    []
  );

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setMenuMessage("");
    setMenuError("");
    closeCropModal();

    if (!allowedImageTypes.includes(file.type)) {
      setMenuError("Please choose a JPG, PNG, or WEBP image.");
      event.target.value = "";
      return;
    }

    if (file.size > maxInitialImageSize) {
      setMenuError("This image is a bit too large to process. Please try a different photo.");
      event.target.value = "";
      return;
    }

    setCropSourceFile(file);
    setCropImageUrl(URL.createObjectURL(file));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    event.target.value = "";
  }

  async function saveCroppedImage() {
    if (!cropImageUrl || !cropSourceFile || !croppedAreaPixels) return;

    setIsUploadingImage(true);
    setMenuMessage("");
    setMenuError("");

    try {
      const croppedFile = await getCroppedImageFile(
        cropImageUrl,
        croppedAreaPixels
      );
      const compressedImage = await imageCompression(
        croppedFile,
        compressionOptions
      );

      if (compressedImage.size > maxCompressedImageSize) {
        setMenuError(
          "This image is a bit too large to process. Please try a different photo."
        );
        return;
      }

      const uploadFile = new File(
        [compressedImage],
        `${cropSourceFile.name.replace(/\.[^.]+$/, "") || "menu-image"}.webp`,
        { type: compressedImage.type || "image/webp" }
      );
      const formData = new FormData();
      formData.append("file", uploadFile);

      const response = await fetch("/api/admin/menu/upload-image", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (!response.ok) {
        setMenuError(
          result.error ||
            "This image is a bit too large to process. Please try a different photo."
        );
        return;
      }

      setForm((current) => ({
        ...current,
        imageUrl: result.imageUrl,
      }));

      setMenuMessage("Image uploaded. Save the menu item to apply it.");
      closeCropModal();
    } catch (error) {
      setMenuError(
        error instanceof Error
          ? error.message
          : "Something went wrong while uploading the image."
      );
    } finally {
      setIsUploadingImage(false);
    }
  }

  function removeUploadedImage() {
    setForm((current) => ({
      ...current,
      imageUrl: "",
    }));
  }

  function syncMenuItem(savedItem: AdminMenuItem) {
    setMenuItems((current) => {
      const itemExists = current.some((item) => item.id === savedItem.id);
      const nextItems = itemExists
        ? current.map((item) => (item.id === savedItem.id ? savedItem : item))
        : [savedItem, ...current];

      return nextItems.sort((first, second) =>
        first.name.localeCompare(second.name)
      );
    });
  }


  async function saveMenuItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMenuMessage("");
    setMenuError("");

    try {
      const response = await fetch("/api/admin/menu", {
        method: form.id ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: form.id ?? undefined,
          name: form.name,
          category: form.category,
          price: Number(form.price),
          imageUrl: form.imageUrl,
          isAvailable: form.isAvailable,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMenuError(result.error || "Failed to save menu item.");
        return;
      }

      if (result.menuItem) {
        syncMenuItem(result.menuItem);
      }

      setMenuMessage(form.id ? "Menu item updated." : "Menu item added.");
      closeForm();
    } catch {
      setMenuError("Something went wrong while saving the menu item.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteMenuItem() {
    if (!itemToDelete) return;

    setIsDeletingItem(true);
    setMenuMessage("");
    setMenuError("");

    try {
      const response = await fetch(`/api/admin/menu?id=${itemToDelete.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        setMenuError(result.error || "Failed to delete menu item.");
        return;
      }

      setMenuItems((current) => current.filter((i) => i.id !== itemToDelete.id));
      setMenuMessage(`"${itemToDelete.name}" has been removed from the menu.`);
      setIsDeleteConfirmOpen(false);
      setItemToDelete(null);
    } catch {
      setMenuError("Something went wrong while deleting the menu item.");
    } finally {
      setIsDeletingItem(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[#DCCFB8] bg-[#FFFCF7]">
        <div className="px-5 py-4">
          <p className="font-sans text-base font-semibold text-[#0D2E18]">
            Recommendation, category, review, and coverage
          </p>
        </div>

        <div className="grid grid-cols-2 divide-x divide-[#EFE3CF] border-t border-[#EFE3CF] sm:grid-cols-4">
          {[
            {
              label: "Recommendation Candidate",
              value:
                menuIntelligence.recommendationCandidate?.item.name ?? "No item yet",
              detail: menuIntelligence.recommendationCandidate
                ? `${menuIntelligence.recommendationCandidate.signal.orders} orders and ${menuIntelligence.recommendationCandidate.signal.rating.toFixed(1)} rating.`
                : "Waiting for order data.",
              icon: TrendingUp,
            },
            {
              label: "Strongest Category",
              value: menuIntelligence.strongestCategory?.label ?? "No category yet",
              detail: menuIntelligence.strongestCategory
                ? `${menuIntelligence.strongestCategory.orders} orders across ${menuIntelligence.strongestCategory.available} available items.`
                : "No category demand has been detected yet.",
              icon: Layers,
            },
            {
              label: "Review Candidate",
              value: menuIntelligence.reviewCandidate?.item.name ?? "No item yet",
              detail: menuIntelligence.reviewCandidate
                ? `${menuIntelligence.reviewCandidate.signal.orders} orders. ${menuIntelligence.reviewCandidate.signal.rating.toFixed(1)} rating.`
                : "No available item needs review yet.",
              icon: AlertCircle,
            },
            {
              label: "Active Coverage",
              value: `${menuIntelligence.availableCount}/${menuItems.length}`,
              detail: `${menuIntelligence.categoryCount} categories currently have available items for ordering.`,
              icon: LayoutGrid,
            },
          ].map((card) => {
            const Icon = card.icon;

            return (
              <div key={card.label} className="relative px-5 py-4">
                <Icon size={15} className="absolute right-4 top-4 text-[#8C7A64]" />
                <p className="font-sans text-[10px] uppercase tracking-[0.12em] text-[#8C7A64]">
                  {card.label}
                </p>
                <p className="mt-2 font-sans text-lg font-bold text-[#0D2E18]">
                  {card.value}
                </p>
                <p className="mt-1 font-sans text-xs text-[#8C7A64]">
                  {card.detail}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex w-full items-center gap-3 rounded-xl border border-[#DCCFB8] bg-[#FFFCF7] px-4 py-2 sm:max-w-[420px]">
          <Search size={17} className="text-[#8C7A64]" />
          <input
            value={menuSearch}
            onChange={(event) => setMenuSearch(event.target.value)}
            placeholder="Search menu items..."
            className="w-full bg-transparent font-sans text-sm text-[#0D2E18] outline-none placeholder:text-[#8C7A64]"
          />
        </label>

        <button
          type="button"
          onClick={openCreateForm}
          className="rounded-xl bg-[#0D2E18] px-4 py-2 font-sans text-sm font-semibold text-[#FFF8EF] transition hover:bg-[#0F441D]"
        >
          + Add New
        </button>
      </div>

      {menuError ? (
        <div className="rounded-[16px] bg-[#FFF1EC] px-5 py-4 font-sans text-sm text-[#9C543D]">
          {menuError}
        </div>
      ) : null}

      {menuMessage ? (
        <div className="rounded-[16px] bg-[#E7F4EA] px-5 py-4 font-sans text-sm text-[#0F441D]">
          {menuMessage}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {menuFilterOptions.map((category) => (
          <button
            key={category.value}
            type="button"
            onClick={() => setMenuCategoryFilter(category.value)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              menuCategoryFilter === category.value
                ? "bg-[#0D2E18] text-[#FFF8EF]"
                : "border border-[#DCCFB8] bg-[#FFFCF7] text-[#684B35] hover:border-[#0D2E18]"
            }`}
          >
            {category.label}
            <span className="ml-2 font-mono text-[10px]">{category.count}</span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-[18px] border border-[#DCCFB8] bg-[#FFFCF7]">
        <div className="min-w-[940px]">
          <div className="grid grid-cols-[1.5fr_1fr_0.7fr_0.9fr_0.9fr_0.7fr] gap-6 px-6 py-3 font-sans text-[10px] font-medium uppercase tracking-[0.12em] text-[#8C7A64]">
            <span>Item</span>
            <span>Category</span>
            <span>Price</span>
            <span>Status</span>
            <span>Signal</span>
            <span>Action</span>
          </div>

          <div className="divide-y divide-[#EFE3CF]">
            {filteredMenuItems.map((item) => {
              const signal =
                menuSignals.get(item.id) ?? getMenuSignal(item, undefined, 1);

              return (
                <div
                  key={item.id}
                  className="grid grid-cols-[1.5fr_1fr_0.7fr_0.9fr_0.9fr_0.7fr] items-center gap-6 px-6 py-3 font-sans text-sm transition hover:bg-[#FFF8EF]/60"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex aspect-square h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#E6F2E8]">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="aspect-square h-full w-full rounded-xl object-cover"
                        />
                      ) : (
                        <div className="h-4 w-4 rounded-full bg-[#D9D9D9]" />
                      )}
                    </div>
                    <p className="text-sm font-semibold text-[#0D2E18]">
                      {item.name}
                    </p>
                  </div>

                  <span className="text-sm text-[#8C7A64]">
                    {formatCategory(item.category)}
                  </span>
                  <span className="text-sm text-[#8C7A64]">
                    {peso(item.price)}
                  </span>

                  <span
                    className={`w-fit rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                      item.isAvailable
                        ? "border-[#C2DFC7] bg-[#E6F2E8] text-[#0F441D]"
                        : "border-[#F5C5BC] bg-[#FFF1EC] text-[#C55432]"
                    }`}
                  >
                    {item.isAvailable ? "Available" : "Not Available"}
                  </span>
                  <div>
                    <SignalChip signal={signal} />
                    <p className="mt-0.5 font-mono text-xs text-[#8C7A64]">
                      {signal.orders} orders
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openEditForm(item)}
                      className="rounded-lg border border-[#DCCFB8] bg-[#FFFCF7] px-3 py-1.5 text-xs font-bold text-[#684B35] transition hover:border-[#0D2E18] hover:text-[#0D2E18]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setItemToDelete(item);
                        setIsDeleteConfirmOpen(true);
                      }}
                      className="rounded-lg border border-[#F5C5BC] bg-[#FFF1EC] px-3 py-1.5 text-xs font-bold text-[#C55432] transition hover:border-[#C55432] hover:bg-[#F5C5BC]/20"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredMenuItems.length === 0 ? (
              <EmptyState label="No matching menu items" />
            ) : null}
          </div>
        </div>
      </div>

      {isFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D2E18]/35 px-4 py-6">
          <button
            type="button"
            aria-label="Close menu form"
            className="absolute inset-0 cursor-default"
            onClick={closeForm}
          />

          <form
            onSubmit={saveMenuItem}
            className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[26px] border border-[#DCCFB8] bg-white p-6 shadow-[0_24px_70px_rgba(13,46,24,0.24)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-sans text-sm uppercase tracking-[0.16em] text-[#684B35]">
                  Menu item
                </p>
                <h2 className="mt-1 font-sans text-3xl font-bold text-[#0D2E18]">
                  {form.id ? "Edit Menu Item" : "Add Menu Item"}
                </h2>
              </div>


            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <label className="font-sans text-sm font-semibold text-[#684B35]">
                Item name
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-[14px] border border-[#D6C6AC] bg-[#FFF8EF] px-4 py-3 text-[#0D2E18] outline-none"
                  required
                />
              </label>

              <label className="font-sans text-sm font-semibold text-[#684B35]">
                Price
                <input
                  type="number"
                  min="1"
                  value={form.price}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      price: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-[14px] border border-[#D6C6AC] bg-[#FFF8EF] px-4 py-3 text-[#0D2E18] outline-none"
                  required
                />
              </label>

              <label className="font-sans text-sm font-semibold text-[#684B35]">
                Category
                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      category: event.target.value as MenuCategory,
                    }))
                  }
                  className="mt-2 w-full rounded-[14px] border border-[#D6C6AC] bg-[#FFF8EF] px-4 py-3 text-[#0D2E18] outline-none"
                >
                  {adminMenuCategories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-3 self-end rounded-[14px] border border-[#D6C6AC] bg-[#FFF8EF] px-4 py-3 font-sans text-sm font-semibold text-[#684B35]">
                <input
                  type="checkbox"
                  checked={form.isAvailable}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isAvailable: event.target.checked,
                    }))
                  }
                  className="h-4 w-4"
                />
                Available for ordering
              </label>

              <div className="lg:col-span-2">
                <p className="font-sans text-sm font-semibold text-[#684B35]">
                  Menu image
                </p>

                <div className="mt-2 flex flex-col gap-4 rounded-[18px] border border-[#D6C6AC] bg-[#FFF8EF] p-4 sm:flex-row sm:items-center">
                  <div className="flex aspect-square h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E7F4EA]">
                    {form.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={form.imageUrl}
                        alt="Menu preview"
                        className="aspect-square h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-[#D9D9D9]" />
                    )}
                  </div>

                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageUpload}
                      disabled={isUploadingImage}
                      className="w-full rounded-[14px] border border-[#D6C6AC] bg-white px-4 py-3 font-sans text-sm text-[#0D2E18] file:mr-4 file:rounded-full file:border-0 file:bg-[#0D2E18] file:px-4 file:py-2 file:font-sans file:text-sm file:font-semibold file:text-[#FFF0DA]"
                    />

                    <p className="mt-2 font-sans text-xs text-[#8C7A64]">
                      Choose any JPG, PNG, or WEBP photo up to 10MB. You can
                      crop it for the circular menu frame before upload.
                    </p>

                    {isUploadingImage ? (
                      <div className="mt-2 flex items-center gap-2 font-sans text-sm font-semibold text-[#0F441D]">
                        <LoadingSpinner className="h-4 w-4" label="Uploading image" />
                        <span>Processing image...</span>
                      </div>
                    ) : null}

                    {form.imageUrl ? (
                      <button
                        type="button"
                        onClick={removeUploadedImage}
                        className="mt-3 rounded-full border border-[#C55432] px-4 py-2 font-sans text-sm font-semibold text-[#C55432] transition hover:bg-[#FFF1EC]"
                      >
                        Remove image
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-[#EFE3CF] pt-5">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-[14px] border border-[#D6C6AC] px-6 py-3 font-sans text-sm font-bold text-[#684B35] transition hover:bg-[#FFF8EF]"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSaving || isUploadingImage}
                className="inline-flex items-center justify-center gap-2 rounded-[14px] bg-[#0D2E18] px-8 py-3 font-sans text-sm font-bold text-[#FFF0DA] disabled:opacity-60"
              >
                {isSaving || isUploadingImage ? (
                  <LoadingSpinner
                    className="h-4 w-4"
                    label={isSaving ? "Saving menu item" : "Uploading image"}
                  />
                ) : null}
                {isSaving
                  ? "Saving..."
                  : isUploadingImage
                  ? "Processing..."
                  : form.id
                  ? "Save Changes"
                  : "Add Menu Item"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <Dialog
        open={Boolean(cropImageUrl)}
        onOpenChange={(open) => {
          if (!open && !isUploadingImage) {
            closeCropModal();
          }
        }}
      >
        <DialogContent className="font-sans">
          <div className="flex items-start justify-between gap-4 border-b border-[#EFE3CF] px-5 py-4">
            <DialogHeader>
              <DialogDescription className="font-bold uppercase tracking-[0.16em]">
                Menu image
              </DialogDescription>
              <DialogTitle>Crop for circle</DialogTitle>
            </DialogHeader>

            <button
              type="button"
              onClick={closeCropModal}
              disabled={isUploadingImage}
              className="rounded-full border border-[#D6C6AC] px-4 py-2 font-sans text-sm font-semibold text-[#684B35] transition hover:bg-[#FFF8EF] disabled:opacity-60"
            >
              Cancel
            </button>
          </div>

          <div className="px-5 py-5">
            <div className="relative h-[330px] overflow-hidden rounded-[22px] bg-[#102F1B] sm:h-[420px]">
              {cropImageUrl ? (
                <Cropper
                  image={cropImageUrl}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  restrictPosition={true}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={handleCropComplete}
                />
              ) : null}
            </div>

            <label className="mt-5 block font-sans text-sm font-bold text-[#684B35]">
              Zoom
              <input
                type="range"
                min="0.3"
                max="4"
                step="0.01"
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                disabled={isUploadingImage}
                className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-[#DCCFB8] accent-[#0D2E18] disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
          </div>

          <DialogFooter className="border-t border-[#EFE3CF] px-5 py-4">
            <button
              type="button"
              onClick={closeCropModal}
              disabled={isUploadingImage}
              className="rounded-[14px] border border-[#D6C6AC] px-6 py-3 font-sans text-sm font-bold text-[#684B35] transition hover:bg-[#FFF8EF] disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={saveCroppedImage}
              disabled={isUploadingImage || !croppedAreaPixels}
              className="inline-flex items-center justify-center gap-2 rounded-[14px] bg-[#0D2E18] px-8 py-3 font-sans text-sm font-bold text-[#FFF0DA] disabled:opacity-60"
            >
              {isUploadingImage ? (
                <LoadingSpinner className="h-4 w-4" label="Saving crop" />
              ) : null}
              {isUploadingImage ? "Saving..." : "Save Crop"}
            </button>
          </DialogFooter>

          <style jsx global>{`
            .reactEasyCrop_Container {
              position: absolute;
              inset: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: var(--font-sans), ui-sans-serif, system-ui, sans-serif;
              overflow: hidden;
              touch-action: none;
              user-select: none;
            }

            .reactEasyCrop_Image,
            .reactEasyCrop_Video {
              max-width: 100%;
              max-height: 100%;
              will-change: transform;
            }

            .reactEasyCrop_CropArea {
              position: absolute;
              left: 50%;
              top: 50%;
              box-sizing: border-box;
              box-shadow: 0 0 0 9999em rgba(13, 46, 24, 0.56);
              overflow: hidden;
            }

            .reactEasyCrop_CropAreaRound {
              border-radius: 9999px;
            }
          `}</style>
        </DialogContent>
      </Dialog>
      {isDeleteConfirmOpen && itemToDelete ? (
        <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
          <DialogContent className="max-w-md rounded-[26px] border border-[#DCCFB8] bg-white p-6 shadow-[0_24px_70px_rgba(13,46,24,0.24)]">
            <DialogHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF1EC] text-[#C55432]">
                <Trash2 size={24} />
              </div>
              <DialogTitle className="mt-4 font-sans text-2xl font-black text-[#0D2E18]">
                Delete Menu Item?
              </DialogTitle>
              <DialogDescription className="font-sans text-sm text-[#8C7A64]">
                Are you sure you want to delete <span className="font-bold text-[#0D2E18]">"{itemToDelete.name}"</span>? 
                This action cannot be undone and will remove it from all customer views.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                disabled={isDeletingItem}
                className="flex-1 rounded-xl border border-[#D6C6AC] px-4 py-3 font-sans text-sm font-bold text-[#684B35] transition hover:bg-[#FFF8EF] disabled:opacity-50"
              >
                Keep Item
              </button>
              <button
                type="button"
                onClick={handleDeleteMenuItem}
                disabled={isDeletingItem}
                className="flex-1 rounded-xl bg-[#C55432] px-4 py-3 font-sans text-sm font-bold text-white transition hover:bg-[#A84328] disabled:opacity-50"
              >
                {isDeletingItem ? <LoadingSpinner label="Deleting..." /> : "Yes, Delete"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

