# SchoolCore

SchoolCore is an open-source, self-hosted school management system designed to help schools manage their day-to-day operations with more flexibility and full control over their data.

## Features

- **Self-hosted** – Keep all of your school's data on your own infrastructure.
- **PWA Support** – Students and staff can access the platform through a web app or install it as a Progressive Web App (PWA) on Android and iOS, with no need to publish to the Google Play Store or Apple App Store.
- **Simple to deploy** – Built with simplicity in mind for school IT teams.

## Server Requirements

| Component | Minimum | Recommended |
| --- | --- | --- |
| CPU | x86_64, 4 cores | x86_64, 6+ cores @ 3.0 GHz or higher |
| RAM | 16 GB | 32 GB+ |
| Storage | 10 GB | 20 GB+ (SSD strongly recommended) |
| GPU | Not required | Only required if using a media encoding module |
| Operating System | Ubuntu Server (tested) | Ubuntu Server (LTS) |

## Installation

> This guide is currently tested only on Ubuntu Server.

### 1. Prepare the server

Connect to your server via SSH and switch to root:

```bash
sudo su
```

Update and upgrade the system:

```bash
apt update && apt upgrade -y
```

Reboot the server:

```bash
reboot
```

### 2. Install dependencies

After reconnecting to the server, switch to root again and install the required packages:

```bash
sudo su
apt install -y git python3 nodejs npm
```

### 3. Clone the repository

```bash
git clone https://github.com/<your-username>/schoolcore-pap.git
cd schoolcore-pap
```

### 4. Finish setup

*Additional setup instructions will be added as the project evolves.*

## Contributing

Contributions are welcome! Feel free to open an issue to report bugs or suggest features, or submit a pull request with your improvements.

## License

This project is licensed under the terms of the [LICENSE](./LICENSE) file.