"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  Download,
  Calendar,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader } from "@/components/ui/loader";
import type { Booking, Facility } from "@/types";
import { currencyFormat } from "@/lib/utils";
import { useAuth } from "../AuthProvider";

interface BookingManagementProps {
  bookings: Booking[];
  facilities: Facility[];
  onRefresh?: () => void;
  onUpdateBooking?: (booking: Booking) => Promise<void>;
  onDeleteBooking?: (bookingId: string) => Promise<void>;
  onCreateBooking?: (booking: Partial<Booking>) => Promise<void>;
}

import { BookingDetailsModal } from "./booking-calendar/bookingDetailsModal";

const BookingManagement = ({
  bookings,
  facilities,
  onRefresh,
  onUpdateBooking,
  onDeleteBooking,
  onCreateBooking,
}: BookingManagementProps) => {
  const { user } = useAuth();

  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [formData, setFormData] = useState<Partial<Booking>>({});

  useEffect(() => {
    const filtered = bookings.filter((booking) => {
      if (!booking || booking.isDeleted) return false;

      const facilityName = facilities.find(f => f._id === (booking.facility as any))?.name || "";
      const matchesSearch =
        booking.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        facilityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.user?.email?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || booking.status === statusFilter;
      const matchesPayment =
        paymentFilter === "all" || booking.paymentStatus === paymentFilter;

      let matchesDate = true;
      if (dateFilter === "today") {
        const today = new Date();
        matchesDate =
          new Date(booking.startDate).toDateString() === today.toDateString();
      } else if (dateFilter === "week") {
        const weekFromNow = new Date();
        weekFromNow.setDate(weekFromNow.getDate() + 7);
        matchesDate = new Date(booking.startDate) <= weekFromNow;
      } else if (dateFilter === "month") {
        const monthFromNow = new Date();
        monthFromNow.setMonth(monthFromNow.getMonth() + 1);
        matchesDate = new Date(booking.startDate) <= monthFromNow;
      }

      return matchesSearch && matchesStatus && matchesPayment && matchesDate;
    });

    setFilteredBookings(filtered);
    setCurrentPage(1);
  }, [searchTerm, statusFilter, paymentFilter, dateFilter, bookings]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "confirmed":
      case "completed":
        return CheckCircle;
      case "pending":
        return Clock;
      case "cancelled":
        return XCircle;
      case "no_show":
        return AlertTriangle;
      default:
        return Clock;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "success";
      case "pending":
        return "warning";
      case "cancelled":
        return "danger";
      case "completed":
        return "info";
      case "no_show":
        return "secondary";
      default:
        return "primary";
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "success";
      case "pending":
        return "warning";
      case "failed":
        return "danger";
      case "refunded":
        return "info";
      case "partial_refund":
        return "warning";
      default:
        return "secondary";
    }
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentBookings = filteredBookings.slice(
    indexOfFirstItem,
    indexOfLastItem
  );
  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);

  const handleViewDetails = (booking: Booking) => {
    setSelectedBooking(booking);
    setShowDetailsModal(true);
  };

  const handleEditBooking = (booking: Booking) => {
    setEditingBooking(booking);
    setFormData({
      ...booking,
      startDate: new Date(booking.startDate),
      endDate: new Date(booking.endDate),
    });
    setShowDetailsModal(false);
    setShowEditModal(true);
  };

  const handleStatusChange = async (booking: Booking, newStatus: string) => {
    setIsSaving(true);
    try {
      const updatedBooking = {
        ...booking,
        status: newStatus as Booking["status"],
        updatedAt: new Date(),
      };

      if (onUpdateBooking) {
        await onUpdateBooking(updatedBooking);
        setSelectedBooking(updatedBooking);
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error("Error updating status:", err);
      setError("Failed to update booking status");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBooking = async () => {
    if (!formData.facility || !formData.startDate || !formData.endDate) {
      setError("Please fill in all required fields");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const bookingData = {
        ...formData,
        user: formData.user ?? user ?? undefined,
        duration: calculateDuration(
          formData.startDate.toISOString(),
          formData.endDate.toISOString()
        ),
      };

      if (editingBooking) {
        if (onUpdateBooking) {
          await onUpdateBooking({
            ...editingBooking,
            ...bookingData,
          } as Booking);
          if (onRefresh) onRefresh();
        }
      } else {
        // Create new booking
        if (onCreateBooking) {
          await onCreateBooking({
            ...bookingData,
            createdAt: new Date(),
            isDeleted: false,
          });
          if (onRefresh) onRefresh();
        }
      }

      setShowEditModal(false);
      setFormData({});
      setEditingBooking(null);
    } catch (err) {
      console.error("Error saving booking:", err);
      setError("Failed to save booking");
    } finally {
      setIsSaving(false);
    }
  };
  const handleDeleteBooking = async (booking: Booking) => {
    if (!window.confirm("Are you sure you want to delete this booking?")) {
      return;
    }

    setIsSaving(true);
    try {
      if (onDeleteBooking && booking._id) {
        await onDeleteBooking(booking._id);
        setShowDetailsModal(false);
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error("Error deleting booking:", err);
      setError("Failed to delete booking");
    } finally {
      setIsSaving(false);
    }
  };

  const calculateDuration = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    return `${diffHours} hour${diffHours !== 1 ? "s" : ""}`;
  };

  const getStatusVariant = (
    status: string
  ): "secondary" | "destructive" | "default" | "outline" | null | undefined => {
    switch (status) {
      case "confirmed":
        return "default";
      case "pending":
        return "secondary";
      case "cancelled":
        return "destructive";
      case "completed":
        return "default";
      case "no_show":
        return "outline";
      default:
        return "secondary";
    }
  };

  const getPaymentStatusVariant = (
    status: string
  ): "secondary" | "destructive" | "default" | "outline" | null | undefined => {
    switch (status) {
      case "completed":
        return "default";
      case "pending":
        return "secondary";
      case "failed":
        return "destructive";
      case "refunded":
        return "outline";
      case "partial_refund":
        return "outline";
      default:
        return "secondary";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Booking Management
            </h1>
            <p className="text-gray-600">
              Manage all facility bookings and reservations
            </p>
          </div>
          <div className="flex gap-3 mt-4 sm:mt-0">
            <Button
              onClick={() => {
                setFormData({
                  startDate: new Date(),
                  endDate: new Date(Date.now() + 60 * 60 * 1000),
                  status: "pending",
                  paymentStatus: "pending",
                  totalPrice: 0,
                  duration: "1 hour",
                  notes: "",
                  internalNotes: "",
                });
                setEditingBooking(null);
                setShowEditModal(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Booking
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {bookings.length}
                  </p>
                  <p className="text-sm text-gray-600">Total Bookings</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {bookings.filter((b) => b.status === "confirmed").length}
                  </p>
                  <p className="text-sm text-gray-600">Confirmed</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {currencyFormat(
                      bookings
                        .filter((b) =>
                          ["confirmed", "completed"].includes(b.status)
                        )
                        .reduce((sum, b) => sum + (b.totalPrice || 0), 0)
                    )}
                  </p>
                  <p className="text-sm text-gray-600">Total Revenue</p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg">
                  <DollarSign className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {bookings.filter((b) => b.status === "pending").length}
                  </p>
                  <p className="text-sm text-gray-600">Pending Review</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg">
                  <Clock className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6 bg-white shadow-sm">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="search">Search bookings</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="search"
                    placeholder="Search bookings..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="no_show">No Show</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Payment</Label>
                <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Payments</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Date Range</Label>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Dates</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="text-sm text-gray-600 pt-2">
                Showing {filteredBookings.length} of {bookings.length} bookings
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-gray-200">
                    <TableHead className="font-semibold text-gray-900">
                      Booking ID
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900">
                      Customer
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900">
                      Facility
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900">
                      Date & Time
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900">
                      Duration
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900">
                      Status
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900">
                      Payment
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900">
                      Amount
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.map((booking) => (
                    <TableRow key={booking._id} className="hover:bg-gray-50">
                      <TableCell className="font-mono text-sm">
                        #{booking._id?.slice(-8) || "N/A"}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-gray-900">
                            {booking.user?.name || "Unknown User"}
                          </div>
                          <div className="text-sm text-gray-500">
                            {booking.user?.email || "No email"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {facilities.find(f => f._id === (booking.facility as any))?.name || "Unknown Facility"}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {new Date(booking.startDate).toLocaleDateString()}
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(booking.startDate).toLocaleTimeString(
                              [],
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {calculateDuration(
                          booking.startDate.toLocaleString(),
                          booking.endDate.toLocaleString()
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(booking.status)}>
                          {booking.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getPaymentStatusVariant(
                            booking.paymentStatus
                          )}
                        >
                          {booking.paymentStatus?.toUpperCase() || "PENDING"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {currencyFormat(booking.totalPrice || 0)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedBooking(booking);
                              setShowDetailsModal(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingBooking(booking);
                              setFormData({
                                facility: booking.facility,
                                user: booking.user,
                                startDate: new Date(booking.startDate),
                                endDate: new Date(booking.endDate),
                                status: booking.status,
                                paymentStatus:
                                  booking.paymentStatus || "pending",
                                totalPrice: booking.totalPrice || 0,
                                duration: booking.duration || "",
                                notes: booking.notes || "",
                                internalNotes: booking.internalNotes || "",
                              });
                              setShowEditModal(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteBooking(booking)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingBooking ? "Edit Booking" : "Create New Booking"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="facility">Facility *</Label>
                <Select
                  value={(formData.facility as any) || ""}
                  onValueChange={(value) => {
                    setFormData((prev) => ({ ...prev, facility: value as any }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select facility" />
                  </SelectTrigger>
                  <SelectContent>
                    {facilities.map((facility) => (
                      <SelectItem key={facility._id} value={facility._id}>
                        {facility.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      status: value as Booking["status"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="no_show">No Show</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date & Time *</Label>
                <Input
                  id="startDate"
                  type="datetime-local"
                  value={
                    formData.startDate
                      ? new Date(
                          formData.startDate.getTime() -
                            formData.startDate.getTimezoneOffset() * 60000
                        )
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                  onChange={(e) => {
                    const date = new Date(e.target.value);
                    setFormData((prev) => ({ ...prev, startDate: date }));
                  }}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date & Time *</Label>
                <Input
                  id="endDate"
                  type="datetime-local"
                  value={
                    formData.endDate
                      ? new Date(
                          formData.endDate.getTime() -
                            formData.endDate.getTimezoneOffset() * 60000
                        )
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                  onChange={(e) => {
                    const date = new Date(e.target.value);
                    setFormData((prev) => ({ ...prev, endDate: date }));
                  }}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="paymentStatus">Payment Status</Label>
                <Select
                  value={formData.paymentStatus || "pending"}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      paymentStatus: value as Booking["paymentStatus"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                    <SelectItem value="partial_refund">
                      Partial Refund
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="totalPrice">Total Price</Label>
                <Input
                  id="totalPrice"
                  type="number"
                  step="0.01"
                  value={formData.totalPrice || 0}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      totalPrice: Number.parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={3}
                value={formData.notes || ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Customer notes..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="internalNotes">Internal Notes</Label>
              <Textarea
                id="internalNotes"
                rows={2}
                value={formData.internalNotes || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    internalNotes: e.target.value,
                  }))
                }
                placeholder="Internal staff notes..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handleSaveBooking}
              disabled={
                isSaving ||
                !formData.facility ||
                !formData.startDate ||
                !formData.endDate
              }
            >
              {isSaving && <Loader size="sm" className="mr-2" />}
              {editingBooking ? "Update" : "Create"} Booking
            </Button>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
        <BookingDetailsModal
          booking={selectedBooking}
          onClose={() => setShowDetailsModal(false)}
          isOpen={showDetailsModal}
          isSaving={isSaving}
          onDelete={handleDeleteBooking}
          onEdit={handleEditBooking}
          onStatusChange={handleStatusChange}
        />
      </Dialog>
    </div>
  );
};

export default BookingManagement;
