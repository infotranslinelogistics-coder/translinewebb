import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-987e9da2/health", (c) => {
  return c.json({ status: "ok" });
});

// ============ DASHBOARD & STATS ============

app.get("/make-server-987e9da2/stats", async (c) => {
  try {
    const shifts = await kv.getByPrefix("shift:");
    const drivers = await kv.getByPrefix("driver:");
    const vehicles = await kv.getByPrefix("vehicle:");
    const events = await kv.getByPrefix("event:");
    
    const activeShifts = shifts.filter(s => s.value.status === 'active');
    const failedEvents = events.filter(e => e.value.status === 'failed');
    const stuckShifts = activeShifts.filter(s => {
      const duration = Date.now() - new Date(s.value.start_time).getTime();
      return duration > 12 * 60 * 60 * 1000; // More than 12 hours
    });
    const missingOdometer = activeShifts.filter(s => !s.value.start_odometer_photo);
    
    return c.json({
      activeShiftsCount: activeShifts.length,
      activeDriversCount: activeShifts.map(s => s.value.driver_id).filter((v, i, a) => a.indexOf(v) === i).length,
      vehiclesInUseCount: activeShifts.map(s => s.value.vehicle_id).filter((v, i, a) => a.indexOf(v) === i).length,
      alerts: {
        stuckShifts: stuckShifts.length,
        missingOdometer: missingOdometer.length,
        failedEvents: failedEvents.length,
      },
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return c.json({ error: `Failed to fetch stats: ${error.message}` }, 500);
  }
});

app.get("/make-server-987e9da2/activity", async (c) => {
  try {
    const adminActions = await kv.getByPrefix("admin_action:");
    const recentActions = adminActions
      .sort((a, b) => new Date(b.value.timestamp).getTime() - new Date(a.value.timestamp).getTime())
      .slice(0, 20);
    
    return c.json({ activities: recentActions.map(a => a.value) });
  } catch (error) {
    console.error("Error fetching activity:", error);
    return c.json({ error: `Failed to fetch activity: ${error.message}` }, 500);
  }
});

// ============ SHIFTS ============

app.get("/make-server-987e9da2/shifts", async (c) => {
  try {
    const status = c.req.query("status");
    const shifts = await kv.getByPrefix("shift:");
    
    let filtered = shifts.map(s => s.value);
    if (status === 'active') {
      filtered = filtered.filter(s => s.status === 'active');
    } else if (status === 'completed') {
      filtered = filtered.filter(s => s.status === 'completed');
    }
    
    return c.json({ shifts: filtered });
  } catch (error) {
    console.error("Error fetching shifts:", error);
    return c.json({ error: `Failed to fetch shifts: ${error.message}` }, 500);
  }
});

app.get("/make-server-987e9da2/shifts/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const shift = await kv.get(`shift:${id}`);
    
    if (!shift) {
      return c.json({ error: "Shift not found" }, 404);
    }
    
    // Get related events
    const events = await kv.getByPrefix(`event:${id}:`);
    
    return c.json({ 
      shift,
      events: events.map(e => e.value).sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )
    });
  } catch (error) {
    console.error("Error fetching shift:", error);
    return c.json({ error: `Failed to fetch shift: ${error.message}` }, 500);
  }
});

app.post("/make-server-987e9da2/shifts/start", async (c) => {
  try {
    const { driver_id, vehicle_id, admin_name } = await c.req.json();
    
    if (!driver_id || !vehicle_id) {
      return c.json({ error: "driver_id and vehicle_id are required" }, 400);
    }
    
    const shift_id = `${Date.now()}_${driver_id}`;
    const shift = {
      id: shift_id,
      driver_id,
      vehicle_id,
      status: 'active',
      start_time: new Date().toISOString(),
      start_odometer_photo: null,
      end_time: null,
      end_odometer_photo: null,
      created_at: new Date().toISOString(),
    };
    
    await kv.set(`shift:${shift_id}`, shift);
    
    // Log admin action
    await logAdminAction('start_shift', admin_name, { shift_id, driver_id, vehicle_id });
    
    return c.json({ shift });
  } catch (error) {
    console.error("Error starting shift:", error);
    return c.json({ error: `Failed to start shift: ${error.message}` }, 500);
  }
});

app.post("/make-server-987e9da2/shifts/:id/force-end", async (c) => {
  try {
    const id = c.req.param("id");
    const { reason, admin_name } = await c.req.json();
    
    if (!reason) {
      return c.json({ error: "Reason is required for force-end" }, 400);
    }
    
    const shift = await kv.get(`shift:${id}`);
    if (!shift) {
      return c.json({ error: "Shift not found" }, 404);
    }
    
    shift.status = 'completed';
    shift.end_time = new Date().toISOString();
    shift.force_ended = true;
    shift.force_end_reason = reason;
    shift.force_ended_by = admin_name;
    
    await kv.set(`shift:${id}`, shift);
    
    // Log admin action
    await logAdminAction('force_end_shift', admin_name, { shift_id: id, reason });
    
    return c.json({ shift });
  } catch (error) {
    console.error("Error force-ending shift:", error);
    return c.json({ error: `Failed to force-end shift: ${error.message}` }, 500);
  }
});

app.post("/make-server-987e9da2/shifts/:id/add-note", async (c) => {
  try {
    const id = c.req.param("id");
    const { note, admin_name } = await c.req.json();
    
    const shift = await kv.get(`shift:${id}`);
    if (!shift) {
      return c.json({ error: "Shift not found" }, 404);
    }
    
    if (!shift.admin_notes) {
      shift.admin_notes = [];
    }
    
    shift.admin_notes.push({
      note,
      admin_name,
      timestamp: new Date().toISOString(),
    });
    
    await kv.set(`shift:${id}`, shift);
    
    return c.json({ shift });
  } catch (error) {
    console.error("Error adding note:", error);
    return c.json({ error: `Failed to add note: ${error.message}` }, 500);
  }
});

app.post("/make-server-987e9da2/shifts/:id/upload-odometer", async (c) => {
  try {
    const id = c.req.param("id");
    const { photo_url, type, admin_name } = await c.req.json();
    
    if (!photo_url || !type) {
      return c.json({ error: "photo_url and type (start/end) are required" }, 400);
    }
    
    const shift = await kv.get(`shift:${id}`);
    if (!shift) {
      return c.json({ error: "Shift not found" }, 404);
    }
    
    if (type === 'start') {
      shift.start_odometer_photo = photo_url;
    } else if (type === 'end') {
      shift.end_odometer_photo = photo_url;
    }
    
    await kv.set(`shift:${id}`, shift);
    
    // Log admin action
    await logAdminAction('upload_odometer', admin_name, { shift_id: id, type });
    
    return c.json({ shift });
  } catch (error) {
    console.error("Error uploading odometer:", error);
    return c.json({ error: `Failed to upload odometer: ${error.message}` }, 500);
  }
});

// ============ EVENTS ============

app.get("/make-server-987e9da2/events", async (c) => {
  try {
    const status = c.req.query("status");
    const events = await kv.getByPrefix("event:");
    
    let filtered = events.map(e => e.value);
    if (status === 'failed') {
      filtered = filtered.filter(e => e.status === 'failed');
    } else if (status === 'invalid') {
      filtered = filtered.filter(e => e.status === 'invalid');
    }
    
    return c.json({ 
      events: filtered.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ) 
    });
  } catch (error) {
    console.error("Error fetching events:", error);
    return c.json({ error: `Failed to fetch events: ${error.message}` }, 500);
  }
});

app.post("/make-server-987e9da2/events/:id/retry", async (c) => {
  try {
    const id = c.req.param("id");
    const { admin_name } = await c.req.json();
    
    const event = await kv.get(`event:${id}`);
    if (!event) {
      return c.json({ error: "Event not found" }, 404);
    }
    
    event.status = 'retrying';
    event.retry_count = (event.retry_count || 0) + 1;
    event.last_retry = new Date().toISOString();
    
    await kv.set(`event:${id}`, event);
    
    // Log admin action
    await logAdminAction('retry_event', admin_name, { event_id: id });
    
    return c.json({ event });
  } catch (error) {
    console.error("Error retrying event:", error);
    return c.json({ error: `Failed to retry event: ${error.message}` }, 500);
  }
});

app.post("/make-server-987e9da2/events/:id/mark-failed", async (c) => {
  try {
    const id = c.req.param("id");
    const { reason, admin_name } = await c.req.json();
    
    const event = await kv.get(`event:${id}`);
    if (!event) {
      return c.json({ error: "Event not found" }, 404);
    }
    
    event.status = 'permanently_failed';
    event.failure_reason = reason;
    
    await kv.set(`event:${id}`, event);
    
    // Log admin action
    await logAdminAction('mark_event_failed', admin_name, { event_id: id, reason });
    
    return c.json({ event });
  } catch (error) {
    console.error("Error marking event as failed:", error);
    return c.json({ error: `Failed to mark event as failed: ${error.message}` }, 500);
  }
});

app.delete("/make-server-987e9da2/events/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const { admin_name } = await c.req.json();
    
    await kv.del(`event:${id}`);
    
    // Log admin action
    await logAdminAction('delete_event', admin_name, { event_id: id });
    
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting event:", error);
    return c.json({ error: `Failed to delete event: ${error.message}` }, 500);
  }
});

// ============ DRIVERS ============

app.get("/make-server-987e9da2/drivers", async (c) => {
  try {
    const drivers = await kv.getByPrefix("driver:");
    return c.json({ drivers: drivers.map(d => d.value) });
  } catch (error) {
    console.error("Error fetching drivers:", error);
    return c.json({ error: `Failed to fetch drivers: ${error.message}` }, 500);
  }
});

app.get("/make-server-987e9da2/drivers/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const driver = await kv.get(`driver:${id}`);
    
    if (!driver) {
      return c.json({ error: "Driver not found" }, 404);
    }
    
    // Get driver's shifts
    const shifts = await kv.getByPrefix("shift:");
    const driverShifts = shifts.filter(s => s.value.driver_id === id).map(s => s.value);
    
    return c.json({ driver, shifts: driverShifts });
  } catch (error) {
    console.error("Error fetching driver:", error);
    return c.json({ error: `Failed to fetch driver: ${error.message}` }, 500);
  }
});

app.post("/make-server-987e9da2/drivers", async (c) => {
  try {
    const { name, email, phone, admin_name } = await c.req.json();
    
    if (!name) {
      return c.json({ error: "Name is required" }, 400);
    }
    
    const driver_id = `driver_${Date.now()}`;
    const driver = {
      id: driver_id,
      name,
      email,
      phone,
      status: 'active',
      created_at: new Date().toISOString(),
      last_login: null,
    };
    
    await kv.set(`driver:${driver_id}`, driver);
    
    // Log admin action
    await logAdminAction('create_driver', admin_name, { driver_id, name });
    
    return c.json({ driver });
  } catch (error) {
    console.error("Error creating driver:", error);
    return c.json({ error: `Failed to create driver: ${error.message}` }, 500);
  }
});

app.put("/make-server-987e9da2/drivers/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const { status, admin_name } = await c.req.json();
    
    const driver = await kv.get(`driver:${id}`);
    if (!driver) {
      return c.json({ error: "Driver not found" }, 404);
    }
    
    if (status) {
      driver.status = status;
    }
    
    await kv.set(`driver:${id}`, driver);
    
    // Log admin action
    await logAdminAction('update_driver', admin_name, { driver_id: id, status });
    
    return c.json({ driver });
  } catch (error) {
    console.error("Error updating driver:", error);
    return c.json({ error: `Failed to update driver: ${error.message}` }, 500);
  }
});

// ============ VEHICLES ============

app.get("/make-server-987e9da2/vehicles", async (c) => {
  try {
    const vehicles = await kv.getByPrefix("vehicle:");
    return c.json({ vehicles: vehicles.map(v => v.value) });
  } catch (error) {
    console.error("Error fetching vehicles:", error);
    return c.json({ error: `Failed to fetch vehicles: ${error.message}` }, 500);
  }
});

app.get("/make-server-987e9da2/vehicles/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const vehicle = await kv.get(`vehicle:${id}`);
    
    if (!vehicle) {
      return c.json({ error: "Vehicle not found" }, 404);
    }
    
    // Get vehicle's shifts
    const shifts = await kv.getByPrefix("shift:");
    const vehicleShifts = shifts.filter(s => s.value.vehicle_id === id).map(s => s.value);
    
    return c.json({ vehicle, shifts: vehicleShifts });
  } catch (error) {
    console.error("Error fetching vehicle:", error);
    return c.json({ error: `Failed to fetch vehicle: ${error.message}` }, 500);
  }
});

app.post("/make-server-987e9da2/vehicles", async (c) => {
  try {
    const { license_plate, make, model, year, admin_name } = await c.req.json();
    
    if (!license_plate) {
      return c.json({ error: "License plate is required" }, 400);
    }
    
    const vehicle_id = `vehicle_${Date.now()}`;
    const vehicle = {
      id: vehicle_id,
      license_plate,
      make,
      model,
      year,
      status: 'active',
      maintenance_required: false,
      created_at: new Date().toISOString(),
    };
    
    await kv.set(`vehicle:${vehicle_id}`, vehicle);
    
    // Log admin action
    await logAdminAction('create_vehicle', admin_name, { vehicle_id, license_plate });
    
    return c.json({ vehicle });
  } catch (error) {
    console.error("Error creating vehicle:", error);
    return c.json({ error: `Failed to create vehicle: ${error.message}` }, 500);
  }
});

app.put("/make-server-987e9da2/vehicles/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const { status, maintenance_required, admin_name } = await c.req.json();
    
    const vehicle = await kv.get(`vehicle:${id}`);
    if (!vehicle) {
      return c.json({ error: "Vehicle not found" }, 404);
    }
    
    if (status) vehicle.status = status;
    if (maintenance_required !== undefined) vehicle.maintenance_required = maintenance_required;
    
    await kv.set(`vehicle:${id}`, vehicle);
    
    // Log admin action
    await logAdminAction('update_vehicle', admin_name, { vehicle_id: id, status, maintenance_required });
    
    return c.json({ vehicle });
  } catch (error) {
    console.error("Error updating vehicle:", error);
    return c.json({ error: `Failed to update vehicle: ${error.message}` }, 500);
  }
});

// ============ ODOMETER PHOTOS ============

app.get("/make-server-987e9da2/odometer-photos", async (c) => {
  try {
    const shifts = await kv.getByPrefix("shift:");
    const photos = [];
    
    for (const shiftItem of shifts) {
      const shift = shiftItem.value;
      if (shift.start_odometer_photo) {
        photos.push({
          shift_id: shift.id,
          type: 'start',
          photo_url: shift.start_odometer_photo,
          timestamp: shift.start_time,
          driver_id: shift.driver_id,
          vehicle_id: shift.vehicle_id,
        });
      }
      if (shift.end_odometer_photo) {
        photos.push({
          shift_id: shift.id,
          type: 'end',
          photo_url: shift.end_odometer_photo,
          timestamp: shift.end_time,
          driver_id: shift.driver_id,
          vehicle_id: shift.vehicle_id,
        });
      }
    }
    
    return c.json({ photos: photos.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ) });
  } catch (error) {
    console.error("Error fetching odometer photos:", error);
    return c.json({ error: `Failed to fetch odometer photos: ${error.message}` }, 500);
  }
});

// ============ ADMIN ACTIONS ============

app.get("/make-server-987e9da2/admin-actions", async (c) => {
  try {
    const actions = await kv.getByPrefix("admin_action:");
    return c.json({ 
      actions: actions.map(a => a.value).sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ) 
    });
  } catch (error) {
    console.error("Error fetching admin actions:", error);
    return c.json({ error: `Failed to fetch admin actions: ${error.message}` }, 500);
  }
});

// ============ SEED DATA ============

app.post("/make-server-987e9da2/seed", async (c) => {
  try {
    // Create sample drivers
    const drivers = [
      { id: 'driver_1', name: 'John Martinez', email: 'john@logistics.com', phone: '555-0101', status: 'active', last_login: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), created_at: new Date('2024-01-15').toISOString() },
      { id: 'driver_2', name: 'Sarah Chen', email: 'sarah@logistics.com', phone: '555-0102', status: 'active', last_login: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), created_at: new Date('2024-02-10').toISOString() },
      { id: 'driver_3', name: 'Michael Johnson', email: 'michael@logistics.com', phone: '555-0103', status: 'active', last_login: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), created_at: new Date('2024-01-20').toISOString() },
      { id: 'driver_4', name: 'Lisa Rodriguez', email: 'lisa@logistics.com', phone: '555-0104', status: 'inactive', last_login: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(), created_at: new Date('2023-11-05').toISOString() },
      { id: 'driver_5', name: 'David Kim', email: 'david@logistics.com', phone: '555-0105', status: 'active', last_login: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), created_at: new Date('2024-03-01').toISOString() },
    ];
    
    for (const driver of drivers) {
      await kv.set(`driver:${driver.id}`, driver);
    }
    
    // Create sample vehicles
    const vehicles = [
      { id: 'vehicle_1', license_plate: 'ABC-1234', make: 'Ford', model: 'Transit', year: 2022, status: 'active', maintenance_required: false, created_at: new Date('2022-06-15').toISOString() },
      { id: 'vehicle_2', license_plate: 'XYZ-5678', make: 'Mercedes', model: 'Sprinter', year: 2023, status: 'active', maintenance_required: false, created_at: new Date('2023-01-20').toISOString() },
      { id: 'vehicle_3', license_plate: 'DEF-9012', make: 'RAM', model: 'ProMaster', year: 2021, status: 'active', maintenance_required: true, created_at: new Date('2021-09-10').toISOString() },
      { id: 'vehicle_4', license_plate: 'GHI-3456', make: 'Chevrolet', model: 'Express', year: 2022, status: 'active', maintenance_required: false, created_at: new Date('2022-11-05').toISOString() },
      { id: 'vehicle_5', license_plate: 'JKL-7890', make: 'Ford', model: 'E-350', year: 2020, status: 'maintenance', maintenance_required: true, created_at: new Date('2020-03-22').toISOString() },
    ];
    
    for (const vehicle of vehicles) {
      await kv.set(`vehicle:${vehicle.id}`, vehicle);
    }
    
    // Create sample active shifts
    const activeShifts = [
      {
        id: 'shift_active_1',
        driver_id: 'driver_1',
        vehicle_id: 'vehicle_1',
        status: 'active',
        start_time: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        start_odometer_photo: 'https://images.unsplash.com/photo-1606838493583-0763ba47f957?w=400',
        end_time: null,
        end_odometer_photo: null,
        created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        admin_notes: [],
      },
      {
        id: 'shift_active_2',
        driver_id: 'driver_2',
        vehicle_id: 'vehicle_2',
        status: 'active',
        start_time: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        start_odometer_photo: 'https://images.unsplash.com/photo-1606838493583-0763ba47f957?w=400',
        end_time: null,
        end_odometer_photo: null,
        created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        admin_notes: [],
      },
      {
        id: 'shift_active_3',
        driver_id: 'driver_5',
        vehicle_id: 'vehicle_4',
        status: 'active',
        start_time: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        start_odometer_photo: null, // Missing odometer photo
        end_time: null,
        end_odometer_photo: null,
        created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        admin_notes: [],
      },
      {
        id: 'shift_stuck_1',
        driver_id: 'driver_3',
        vehicle_id: 'vehicle_3',
        status: 'active',
        start_time: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(), // 14 hours ago - STUCK
        start_odometer_photo: 'https://images.unsplash.com/photo-1606838493583-0763ba47f957?w=400',
        end_time: null,
        end_odometer_photo: null,
        created_at: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
        admin_notes: [],
      },
    ];
    
    for (const shift of activeShifts) {
      await kv.set(`shift:${shift.id}`, shift);
    }
    
    // Create sample completed shifts
    const completedShifts = [
      {
        id: 'shift_completed_1',
        driver_id: 'driver_1',
        vehicle_id: 'vehicle_1',
        status: 'completed',
        start_time: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        start_odometer_photo: 'https://images.unsplash.com/photo-1606838493583-0763ba47f957?w=400',
        end_time: new Date(Date.now() - 16 * 60 * 60 * 1000).toISOString(),
        end_odometer_photo: 'https://images.unsplash.com/photo-1606838493583-0763ba47f957?w=400',
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        admin_notes: [],
      },
    ];
    
    for (const shift of completedShifts) {
      await kv.set(`shift:${shift.id}`, shift);
    }
    
    // Create sample events
    const events = [
      {
        id: 'event:shift_active_1:1',
        shift_id: 'shift_active_1',
        type: 'shift_started',
        status: 'success',
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        data: { driver_id: 'driver_1', vehicle_id: 'vehicle_1' },
      },
      {
        id: 'event:shift_active_1:2',
        shift_id: 'shift_active_1',
        type: 'location_update',
        status: 'success',
        timestamp: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
        data: { lat: 40.7128, lng: -74.0060 },
      },
      {
        id: 'event:failed_1',
        shift_id: null,
        type: 'odometer_upload',
        status: 'failed',
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        error: 'Network timeout after 30s',
        retry_count: 3,
        data: {},
      },
      {
        id: 'event:failed_2',
        shift_id: 'shift_active_2',
        type: 'location_update',
        status: 'failed',
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        error: 'Invalid GPS coordinates',
        retry_count: 2,
        data: { lat: null, lng: null },
      },
    ];
    
    for (const event of events) {
      await kv.set(`event:${event.id}`, event);
    }
    
    // Create sample admin actions
    const adminActions = [
      {
        id: 'admin_action_1',
        action: 'force_end_shift',
        admin_name: 'Admin User',
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        data: { shift_id: 'shift_old_1', reason: 'Driver reported vehicle issues' },
      },
      {
        id: 'admin_action_2',
        action: 'update_vehicle',
        admin_name: 'Admin User',
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        data: { vehicle_id: 'vehicle_3', maintenance_required: true },
      },
    ];
    
    for (const action of adminActions) {
      await kv.set(`admin_action:${action.id}`, action);
    }
    
    return c.json({ message: "Database seeded successfully" });
  } catch (error) {
    console.error("Error seeding database:", error);
    return c.json({ error: `Failed to seed database: ${error.message}` }, 500);
  }
});

// Helper function to log admin actions
async function logAdminAction(action: string, admin_name: string, data: any) {
  const action_id = `admin_action_${Date.now()}`;
  const adminAction = {
    id: action_id,
    action,
    admin_name: admin_name || 'Unknown Admin',
    timestamp: new Date().toISOString(),
    data,
  };
  await kv.set(`admin_action:${action_id}`, adminAction);
}

Deno.serve(app.fetch);
