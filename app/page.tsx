"use client";

import type React from "react";

import { useState, useEffect } from "react";
import {
  Folder,
  File,
  Upload,
  FolderPlus,
  MoreVertical,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";

import { createClient } from "@/lib/supabase";

const supabase = createClient();

type FileItem = {
  name: string;
  fullPath: string;
  isFolder: boolean;
  size?: number;
  type?: string;
  downloadURL?: string;
};

export default function Home() {

const [currentPath, setCurrentPath] = useState("");
const [items, setItems] = useState<FileItem[]>([]);
const [loading, setLoading] = useState(true);
const [newFolderDialog, setNewFolderDialog] = useState(false);
const [newFolderName, setNewFolderName] = useState("");
const [renameDialog, setRenameDialog] = useState(false);
const [renameItem, setRenameItem] = useState<FileItem | null>(null);
const [newName, setNewName] = useState("");
const [pathSegments, setPathSegments] = useState<string[]>([]);

useEffect(() => {
  loadItems();
  updatePathSegments();
}, [currentPath]);

const updatePathSegments = () => {
  setPathSegments(currentPath.split("/").filter((p) => p));
};

const loadItems = async () => {
  setLoading(true);
  try {
    const { data, error } = await supabase.storage
      .from("private files")
      .list(currentPath, {
        limit: 100,
        sortBy: { column: "name", order: "asc" },
      });

    if (error) throw error;

    const folderPaths = new Set<string>();
    const fileItems: FileItem[] = [];

    for (const item of data) {
      const parts = item.name.split("/");

      // Detect folders using .folder marker
      if (parts.length === 2 && parts[1] === ".folder") {
        folderPaths.add(parts[0]);
        continue;
      }

      // Detect files
      if (!item.name.includes("/")) {
        const fullPath = currentPath
          ? `${currentPath}/${item.name}`
          : item.name;
        const { data: urlData } = supabase.storage
          .from("private files")
          .getPublicUrl(fullPath);

        fileItems.push({
          name: item.name,
          fullPath,
          isFolder: false,
          downloadURL: urlData.publicUrl,
        });
      }
    }

    const folderItems = Array.from(folderPaths).map((name) => ({
      name,
      fullPath: currentPath ? `${currentPath}/${name}` : name,
      isFolder: true,
    }));

    setItems([
      ...folderItems.sort((a, b) => a.name.localeCompare(b.name)),
      ...fileItems.sort((a, b) => a.name.localeCompare(b.name)),
    ]);
  } catch (error) {
    console.error("Error loading items:", error);
    toast({
      title: "Error",
      description: "Failed to load files and folders",
      variant: "destructive",
    });
  } finally {
    setLoading(false);
  }
};

const handleCreateFolder = async () => {
  if (!newFolderName.trim()) {
    toast({
      title: "Error",
      description: "Folder name cannot be empty",
      variant: "destructive",
    });
    return;
  }

  try {
    const folderPath = currentPath
      ? `${currentPath}/${newFolderName}/.folder`
      : `${newFolderName}/.folder`;

    const { error } = await supabase.storage
      .from("private files")
      .upload(folderPath, new Blob([]));

    if (error) throw error;

    loadItems();
    setNewFolderDialog(false);
    setNewFolderName("");
    toast({
      title: "Success",
      description: `Folder "${newFolderName}" created successfully`,
    });
  } catch (error) {
    console.error("Error creating folder:", error);
    toast({
      title: "Error",
      description: "Failed to create folder",
      variant: "destructive",
    });
  }
};

const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = currentPath ? `${currentPath}/${file.name}` : file.name;

      const { error } = await supabase.storage
        .from("private files")
        .upload(filePath, file);

      if (error) throw error;
    }

    toast({
      title: "Success",
      description: `${files.length} file(s) uploaded successfully`,
    });
    loadItems();
  } catch (error) {
    console.error("Error uploading files:", error);
    toast({
      title: "Error",
      description: "Failed to upload files",
      variant: "destructive",
    });
  } finally {
    event.target.value = "";
  }
};

const handleFolderUpload = async (
  event: React.ChangeEvent<HTMLInputElement>
) => {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = file.webkitRelativePath;
      const uploadPath = currentPath
        ? `${currentPath}/${relativePath}`
        : relativePath;

      const { error } = await supabase.storage
        .from("private files")
        .upload(uploadPath, file);

      if (error) throw error;
    }

    toast({
      title: "Success",
      description: `Folder uploaded successfully with ${files.length} files`,
    });
    loadItems();
  } catch (error) {
    console.error("Error uploading folder:", error);
    toast({
      title: "Error",
      description: "Failed to upload folder",
      variant: "destructive",
    });
  } finally {
    event.target.value = "";
  }
};

const deleteFolder = async (folderPath: string) => {
  try {
    // Delete all files in folder and subfolders
    const { data: listData, error: listError } = await supabase.storage
      .from("private files")
      .list(folderPath);

    if (listError) throw listError;

    const filesToDelete = listData
      .filter((item) => !item.name.endsWith("/"))
      .map((item) => `${folderPath}/${item.name}`);

    // Add folder marker file
    filesToDelete.push(`${folderPath}/.folder`);

    if (filesToDelete.length > 0) {
      const { error: deleteError } = await supabase.storage
        .from("private files")
        .remove(filesToDelete);
      if (deleteError) throw deleteError;
    }

    // Recursively delete subfolders
    const subfolders = listData
      .filter((item) => item.name.endsWith("/"))
      .map((item) => `${folderPath}/${item.name.slice(0, -1)}`);

    for (const subfolder of subfolders) {
      await deleteFolder(subfolder);
    }
  } catch (error) {
    throw error;
  }
};

const handleDelete = async (item: FileItem) => {
  try {
    if (item.isFolder) {
      await deleteFolder(item.fullPath);
    } else {
      const { error } = await supabase.storage
        .from("private files")
        .remove([item.fullPath]);
      if (error) throw error;
    }

    toast({
      title: "Success",
      description: `${item.name} deleted successfully`,
    });
    loadItems();
  } catch (error) {
    console.error("Error deleting item:", error);
    toast({
      title: "Error",
      description: `Failed to delete ${item.name}`,
      variant: "destructive",
    });
  }
};

const handleRename = (item: FileItem) => {
  setRenameItem(item);
  setNewName(item.name);
  setRenameDialog(true);
};

const copyFolderContents = async (sourcePath: string, destPath: string) => {
  const { data: listData, error } = await supabase.storage
    .from("private files")
    .list(sourcePath);

  if (error) throw error;

  for (const item of listData) {
    const oldPath = `${sourcePath}/${item.name}`;
    const newPath = `${destPath}/${item.name}`;

    if (item.name.endsWith("/")) {
      await copyFolderContents(oldPath, newPath);
    } else {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("private files")
        .download(oldPath);
      if (downloadError) throw downloadError;

      const { error: uploadError } = await supabase.storage
        .from("private files")
        .upload(newPath, fileData);
      if (uploadError) throw uploadError;
    }
  }

  // Copy .folder marker
  try {
    const { data: markerData } = await supabase.storage
      .from("private files")
      .download(`${sourcePath}/.folder`);

    if (markerData) {
      await supabase.storage
        .from("private files")
        .upload(`${destPath}/.folder`, markerData);
    }
  } catch {}
};

const performRename = async () => {
  if (!renameItem || !newName.trim()) {
    toast({
      title: "Error",
      description: "New name cannot be empty",
      variant: "destructive",
    });
    return;
  }

  try {
    const oldPath = renameItem.fullPath;
    const newPath = oldPath.split("/").slice(0, -1).concat(newName).join("/");

    if (renameItem.isFolder) {
      await copyFolderContents(oldPath, newPath);
      await deleteFolder(oldPath);
    } else {
      // Download and reupload file
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("private files")
        .download(oldPath);
      if (downloadError) throw downloadError;

      const { error: uploadError } = await supabase.storage
        .from("private files")
        .upload(newPath, fileData);
      if (uploadError) throw uploadError;

      const { error: deleteError } = await supabase.storage
        .from("private files")
        .remove([oldPath]);
      if (deleteError) throw deleteError;
    }

    setRenameDialog(false);
    loadItems();
    toast({
      title: "Success",
      description: `Renamed successfully to ${newName}`,
    });
  } catch (error) {
    console.error("Error renaming:", error);
    toast({
      title: "Error",
      description: "Failed to rename item",
      variant: "destructive",
    });
  }
};

const navigateToFolder = (folderPath: string) => {
  setCurrentPath(folderPath);
};

const navigateUp = () => {
  const pathParts = currentPath.split("/");
  pathParts.pop();
  setCurrentPath(pathParts.join("/"));
};

const navigateToBreadcrumb = (index: number) => {
  const newPath = pathSegments.slice(0, index + 1).join("/");
  setCurrentPath(newPath);
};

  return (
    <main className="h-screen bg-white">
      <div className="flex">

        {/* Sidebar */}
        <section className="w-1/5 h-screen bg-gray-50">

          {/* Header */}
          <div className="bg-black p-6 text-white">
            <h1 className="text-xl font-bold">Cloud Private files File Storage</h1>
            <p className="text-sm text-gray-300 mt-1">
              You deploy it, so no one is gonna delete your files without notice
              :')
            </p>
          </div>
          
          {/* Action Buttons */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col flex-wrap gap-3">
              <Button
                onClick={() => setNewFolderDialog(true)}
                className="bg-black hover:bg-[#1f1f1f] text-white transition-all duration-200"
              >
                <FolderPlus className="h-4 w-4 mr-2" />
                New Folder
              </Button>

              <Button className="bg-black hover:bg-[#1f1f1f] text-white transition-all duration-200">
                <Upload className="h-4 w-4 mr-2" />
                Upload Files
                <Input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </Button>

              <Button className="bg-black hover:bg-[#1f1f1f] text-white transition-all duration-200">
                <Folder className="h-4 w-4 mr-2" />
                Upload Folder
                <Input
                  type="file"
                  webkitdirectory="true"
                  directory=""
                  multiple
                  onChange={handleFolderUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </Button>
            </div>

            {/* Upload Progress */}
            {/* {isUploading && (
              <div className="mt-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
                <p className="text-sm mb-1 text-gray-800 font-medium flex items-center">
                  <Upload className="h-4 w-4 mr-2 animate-pulse" />
                  Uploading: {Math.round(uploadProgress)}%
                </p>
                <Progress value={uploadProgress} className="h-2 bg-gray-100" />
              </div>
            )} */}
          </div>
        </section>

        <div className="w-4/5 h-screen flex flex-col">
          {/* Breadcrumb Navigation */}
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-3 flex items-center flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateToBreadcrumb(-1)}
              disabled={!currentPath}
              className={`rounded-full ${
                !currentPath
                  ? "opacity-50"
                  : "hover:bg-gray-100 hover:text-black"
              }`}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Root
            </Button>

            {pathSegments.length > 0 && (
              <Breadcrumb>
                {pathSegments.map((segment, index) => (
                  <BreadcrumbItem key={index}>
                    {index < pathSegments.length - 1 ? (
                      <>
                        <BreadcrumbLink
                          onClick={() => navigateToBreadcrumb(index)}
                          className="text-gray-700 hover:text-black"
                        >
                          {segment}
                        </BreadcrumbLink>
                        <BreadcrumbSeparator>
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        </BreadcrumbSeparator>
                      </>
                    ) : (
                      <span className="font-medium text-black">{segment}</span>
                    )}
                  </BreadcrumbItem>
                ))}
              </Breadcrumb>
            )}
          </div>

          {/* File/Folder List */}
          <div className="p-6 flex flex-col h-full justify-center items-center">
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12 px-4 h-full flex flex-col justify-center items-center">
                <div className="bg-gray-50 inline-flex rounded-full p-4 mb-4">
                  <Folder className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-800 mb-1">
                  No files or folders
                </h3>
                <p className="text-gray-500 max-w-md mx-auto">
                  Upload files or create a new folder to get started with your
                  cloud storage.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="group border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-all duration-200 hover:border-gray-300 bg-white"
                  >
                    <div
                      className={`p-4 flex items-start ${
                        item.isFolder ? "bg-gray-50" : "bg-white"
                      }`}
                    >
                      {item.isFolder ? (
                        <Folder className="h-10 w-10 text-gray-700 mr-3 mt-1" />
                      ) : (
                        <File className="h-10 w-10 text-gray-500 mr-3 mt-1" />
                      )}

                      <div className="flex-1 min-w-0">
                        {item.isFolder ? (
                          <button
                            onClick={() => navigateToFolder(item.fullPath)}
                            className="text-lg font-medium text-gray-800 hover:text-black truncate block w-full text-left"
                          >
                            {item.name}
                          </button>
                        ) : (
                          <a
                            href={item.downloadURL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-lg font-medium text-gray-800 hover:text-black truncate block w-full"
                          >
                            {item.name}
                          </a>
                        )}
                        <p className="text-sm text-gray-500 mt-1">
                          {item.isFolder ? "Folder" : "File"}
                        </p>
                      </div>
                    </div>

                    <div className="px-4 py-2 border-t border-gray-100 bg-white flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 rounded-full hover:bg-gray-100"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            onClick={() => handleRename(item)}
                            className="cursor-pointer"
                          >
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(item)}
                            className="text-gray-700 hover:text-black cursor-pointer"
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Folder Dialog */}
      <Dialog open={newFolderDialog} onOpenChange={setNewFolderDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Folder Name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="focus-visible:ring-gray-500"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateFolder}
              className="bg-black hover:bg-[#1f1f1f] text-white"
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameDialog} onOpenChange={setRenameDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Rename {renameItem?.isFolder ? "Folder" : "File"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="New Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="focus-visible:ring-gray-500"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={performRename}
              className="bg-black hover:bg-gray-800 text-white"
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
