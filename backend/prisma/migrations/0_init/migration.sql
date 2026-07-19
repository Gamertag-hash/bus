-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "schoolId" TEXT,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bus" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "availableSeats" INTEGER NOT NULL DEFAULT 0,
    "locationLat" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "locationLng" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "driverId" INTEGER,

    CONSTRAINT "Bus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" SERIAL NOT NULL,
    "pickup" TEXT NOT NULL,
    "dropoff" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "busId" INTEGER NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_schoolId_key" ON "User"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Bus_name_key" ON "Bus"("name");

-- AddForeignKey
ALTER TABLE "Bus" ADD CONSTRAINT "Bus_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_busId_fkey" FOREIGN KEY ("busId") REFERENCES "Bus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
