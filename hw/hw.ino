#include "Wire.h"
#include <MPU6050_light.h>
#include <SoftwareSerial.h>

SoftwareSerial BTSerial(2, 3);

MPU6050 mpu(Wire);

long timer = 0;

void setup() {
  Serial.begin(9600);
  BTSerial.begin(9600);
  Wire.begin();
  
  byte status = mpu.begin();
  Serial.print(F("MPU6050 status: "));
  Serial.println(status);
  while(status!=0){ } // stop everything if could not connect to MPU6050
  
  delay(1000);
  mpu.calcOffsets(true,true); // gyro and accelero
}

void loop() {
  mpu.update();

  if(millis() - timer > 100){ // print data every 0.1s
    String data = String(mpu.getAngleX()) + "," + String(mpu.getAngleY()) + "\n";
    BTSerial.print(data);
    Serial.print("Sent: ");
    Serial.println(data);
    timer = millis();
  }

  // Initialize BT AT+NAMExyz / AT+PIN1234
  // if (BTSerial.available()) {
  //   Serial.write(BTSerial.read());
  // }
  // if (Serial.available()) {
  //   BTSerial.write(Serial.read());
  // }
}
