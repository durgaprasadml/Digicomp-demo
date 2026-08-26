import base64
import html

def svg_data_uri(title: str, subtitle: str, icon: str) -> str:
    # Inline SVG keeps the demo self-contained and requires no image hosting.
    safe_title = html.escape(title[:22])
    safe_subtitle = html.escape(subtitle[:28])
    safe_icon = html.escape(icon)
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">
    <rect width="640" height="420" rx="28" fill="#0f172a"/>
    <rect x="24" y="24" width="592" height="372" rx="22" fill="#111827" stroke="#334155" stroke-width="2"/>
    <text x="320" y="120" text-anchor="middle" font-family="Arial" font-size="92">{safe_icon}</text>
    <text x="320" y="220" text-anchor="middle" font-family="Arial" font-size="34" fill="#f8fafc" font-weight="700">{safe_title}</text>
    <text x="320" y="270" text-anchor="middle" font-family="Arial" font-size="22" fill="#94a3b8">{safe_subtitle}</text>
    <text x="320" y="340" text-anchor="middle" font-family="Arial" font-size="18" fill="#38bdf8">DigiComp Demo Product</text>
    </svg>"""
    return "data:image/svg+xml;base64," + base64.b64encode(svg.encode()).decode()

PRODUCTS = [
    (1,"DC-ESP32-01","ESP32 DevKit V1","Microcontroller","WiFi + Bluetooth development board for IoT and robotics projects.",450,24,svg_data_uri("ESP32 DevKit","WiFi + Bluetooth","🔧"),"/product/esp32-devkit","esp32,wifi,bluetooth,iot,microcontroller","3.3V, WiFi, Bluetooth, GPIO, USB"),
    (2,"DC-UNO-01","Arduino Uno R3","Microcontroller","Beginner-friendly Arduino board for robotics and automation.",550,18,svg_data_uri("Arduino Uno","Robotics Controller","🟩"),"/product/arduino-uno","arduino,uno,microcontroller,robotics","5V, ATmega328P, 14 digital IO"),
    (3,"DC-NANO-01","Arduino Nano","Microcontroller","Compact Arduino board for small embedded projects.",400,16,svg_data_uri("Arduino Nano","Compact Controller","🟦"),"/product/arduino-nano","arduino,nano,microcontroller,compact","5V, ATmega328P, compact"),
    (4,"DC-HCSR04-01","HC-SR04 Ultrasonic Sensor","Sensor","Distance sensor commonly used in obstacle avoidance and level measurement.",120,40,svg_data_uri("HC-SR04","Ultrasonic Sensor","📡"),"/product/hc-sr04","ultrasonic,distance,sensor,obstacle","2cm-400cm, 5V"),
    (5,"DC-LDR-01","LDR Light Sensor Module","Sensor","Simple light intensity sensor module for automation projects.",80,35,svg_data_uri("LDR Sensor","Light Detection","☀️"),"/product/ldr","ldr,light,sensor,automation","Analog output, 3.3-5V"),
    (6,"DC-DHT22-01","DHT22 Temperature Humidity Sensor","Sensor","Digital temperature and humidity sensor for weather stations and IoT.",220,22,svg_data_uri("DHT22","Temp + Humidity","🌡️"),"/product/dht22","dht22,temperature,humidity,weather,sensor","-40 to 80C, humidity"),
    (7,"DC-SM01-01","Capacitive Soil Moisture Sensor","Sensor","Corrosion-resistant soil moisture sensor for smart irrigation projects.",160,27,svg_data_uri("Soil Sensor","Smart Irrigation","🌱"),"/product/soil-moisture","soil,moisture,irrigation,sensor,garden","Analog output, 3.3-5V"),
    (8,"DC-L298N-01","L298N Motor Driver","Motor Driver","Dual H-bridge motor driver for small DC motor robotics projects.",150,30,svg_data_uri("L298N","Dual Motor Driver","⚙️"),"/product/l298n","l298n,motor,driver,dc,motor-driver","Up to 35V motor supply"),
    (9,"DC-A4988-01","A4988 Stepper Motor Driver","Motor Driver","Stepper driver for CNC, linear motion and precision robotics projects.",180,20,svg_data_uri("A4988","Stepper Driver","⚙️"),"/product/a4988","a4988,stepper,driver,cnc,motor","8-35V, microstepping"),
    (10,"DC-MOTOR-01","DC Geared Motor 12V","Motor","12V geared DC motor for robot wheels, automation and small machines.",180,45,svg_data_uri("DC Motor","12V Geared","🛞"),"/product/dc-geared-motor","dc,motor,12v,robot,gear","12V, geared, 200 RPM"),
    (11,"DC-NEMA17-01","NEMA17 Stepper Motor","Motor","Standard NEMA17 stepper motor for CNC, 3D printers and motion control.",320,15,svg_data_uri("NEMA17","Stepper Motor","🔩"),"/product/nema17","nema17,stepper,cnc,3d-printer,motor","1.8 degree step angle"),
    (12,"DC-CHASSIS-01","2WD Robot Chassis","Robotics","Acrylic two-wheel robot chassis kit for beginner robotics builds.",250,12,svg_data_uri("2WD Chassis","Robot Platform","🤖"),"/product/2wd-chassis","chassis,robot,2wd,robotics","2 wheel, acrylic"),
    (13,"DC-CHASSIS4-01","4WD Robot Chassis","Robotics","Four-wheel robot chassis for larger obstacle avoidance and line follower builds.",420,8,svg_data_uri("4WD Chassis","Robot Platform","🚙"),"/product/4wd-chassis","chassis,robot,4wd,robotics","4 wheel, acrylic"),
    (14,"DC-RELAY-01","5V 1-Channel Relay Module","Automation","Relay module for switching pumps, lamps, fans and other loads.",90,25,svg_data_uri("Relay","5V Switching","🔌"),"/product/relay-1ch","relay,automation,pump,5v","5V trigger"),
    (15,"DC-PUMP-01","12V Mini Water Pump","Automation","Compact water pump for smart irrigation and liquid transfer demos.",350,10,svg_data_uri("Water Pump","12V Irrigation","💧"),"/product/water-pump","pump,water,irrigation,12v","12V, small DC pump"),
    (16,"DC-BATT-01","12V Rechargeable Battery Pack","Power","Rechargeable battery pack for robot and automation projects.",300,20,svg_data_uri("Battery Pack","12V Rechargeable","🔋"),"/product/battery-pack","battery,12v,power,robot","12V rechargeable"),
    (17,"DC-BUCK-01","LM2596 Buck Converter","Power","Adjustable DC-DC buck converter for powering electronics from higher-voltage sources.",100,32,svg_data_uri("LM2596","Buck Converter","⚡"),"/product/lm2596","lm2596,buck,converter,power,voltage","Input up to 35V"),
    (18,"DC-SERVO-01","SG90 Micro Servo","Motor","Small 180-degree servo for robot arms, mechanisms and sensor positioning.",110,28,svg_data_uri("SG90","Micro Servo","🔧"),"/product/sg90","servo,sg90,robot,servo-motor","5V, 180 degree"),
    (19,"DC-OLED-01","0.96 inch OLED Display","Display","I2C OLED screen for showing sensor values and project status.",160,14,svg_data_uri("OLED","0.96 inch I2C","🖥️"),"/product/oled","oled,display,i2c,screen,arduino","128x64, I2C"),
    (20,"DC-WIRE-01","Jumper Wire Kit","Accessories","Male-male, male-female and female-female jumper wires for prototyping.",90,50,svg_data_uri("Jumper Wires","Prototype Kit","🧵"),"/product/jumper-wires","jumper,wires,prototype,arduino,esp32","M-M, M-F, F-F"),
]
