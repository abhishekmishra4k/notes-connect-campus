import React, { useState, useEffect } from 'react';
import { Search, Upload, BookOpen, User, LogOut, Star, Clock, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const Dashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadData, setUploadData] = useState({
    title: '',
    subject: '',
    description: '',
    file: null as File | null
  });
  const [isUploading, setIsUploading] = useState(false);

  const { user, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSignOut = async () => {
    await signOut();
    setLocation('/');
    toast({
      title: "Signed out",
      description: "You have been successfully signed out.",
    });
  };

  // Fetch notes from API
  const { data: notesData, isLoading, error } = useQuery({
    queryKey: ['/api/notes', { subject: selectedSubject, search: searchTerm }],
    queryFn: async () => {
      const token = localStorage.getItem('authToken');
      const params = new URLSearchParams();
      if (selectedSubject !== 'all') params.set('subject', selectedSubject);
      if (searchTerm) params.set('search', searchTerm);
      
      const response = await fetch(`/api/notes?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch notes');
      }
      
      return response.json();
    },
    enabled: !!user,
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/notes/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notes'] });
      setIsUploadModalOpen(false);
      setUploadData({ title: '', subject: '', description: '', file: null });
      toast({
        title: "Success",
        description: "File uploaded successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = async () => {
    if (!uploadData.file || !uploadData.title || !uploadData.subject) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields and select a file.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', uploadData.file);
    formData.append('title', uploadData.title);
    formData.append('subject', uploadData.subject);
    if (uploadData.description) formData.append('description', uploadData.description);

    uploadMutation.mutate(formData);
  };

  const handleDownload = async (noteId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/notes/${noteId}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = response.headers.get('Content-Disposition')?.split('filename=')[1] || 'download';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Failed to download file.",
        variant: "destructive",
      });
    }
  };

  const subjects = ['all', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science'];
  const notes = notesData?.notes || [];
  const filteredResources = notes;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <BookOpen className="h-8 w-8 text-blue-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">StudyShare</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <User className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-700">{user?.username}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="flex items-center space-x-1"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user?.username}!
          </h1>
          <p className="text-gray-600">
            Discover and share academic resources with your fellow students.
          </p>
        </div>

        {/* Search and Filter Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search for study materials, notes, or resources..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger className="w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map(subject => (
                    <SelectItem key={subject} value={subject}>
                      {subject === 'all' ? 'All Subjects' : subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                className="flex items-center space-x-2"
                onClick={() => setIsUploadModalOpen(true)}
              >
                <Upload className="h-4 w-4" />
                <span>Upload Resource</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Failed to load resources
            </h3>
            <p className="text-gray-500 mb-4">
              There was an error loading the study materials.
            </p>
          </div>
        )}

        {/* Resources Grid */}
        {!isLoading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredResources.map((resource) => (
              <Card key={resource._id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <Badge variant="secondary" className="mb-2">
                      {resource.subject}
                    </Badge>
                    <div className="flex items-center space-x-1 text-sm text-gray-500">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span>{resource.rating || 0}</span>
                    </div>
                  </div>
                  <CardTitle className="text-lg">{resource.title}</CardTitle>
                  <CardDescription className="text-sm">
                    {resource.description || 'No description available'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4" />
                      <span>{new Date(resource.createdAt).toLocaleDateString()}</span>
                    </div>
                    <span>{resource.downloads || 0} downloads</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">
                      by {resource.uploadedBy?.username || 'Unknown'}
                    </span>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleDownload(resource._id)}
                    >
                      Download
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredResources.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No resources found
            </h3>
            <p className="text-gray-500 mb-4">
              Try adjusting your search terms or filter settings.
            </p>
            <Button onClick={() => setIsUploadModalOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload the first resource
            </Button>
          </div>
        )}
      </main>

      {/* Upload Modal */}
      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Study Material</DialogTitle>
            <DialogDescription>
              Share your notes, assignments, or study materials with other students.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Enter title for your material"
                value={uploadData.title}
                onChange={(e) => setUploadData({ ...uploadData, title: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Select
                value={uploadData.subject}
                onValueChange={(value) => setUploadData({ ...uploadData, subject: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.filter(s => s !== 'all').map(subject => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of the material"
                value={uploadData.description}
                onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })}
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="file">File *</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setUploadData({ ...uploadData, file });
                }}
              />
              <p className="text-xs text-gray-500">
                Supported formats: PDF, DOC, DOCX, PPT, PPTX, TXT, JPG, PNG, GIF (Max: 50MB)
              </p>
            </div>
          </div>
          
          <div className="flex justify-end space-x-2 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setIsUploadModalOpen(false);
                setUploadData({ title: '', subject: '', description: '', file: null });
              }}
              disabled={uploadMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleFileUpload}
              disabled={uploadMutation.isPending || !uploadData.file || !uploadData.title || !uploadData.subject}
            >
              {uploadMutation.isPending ? (
                <div className="flex items-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Uploading...
                </div>
              ) : (
                'Upload'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;