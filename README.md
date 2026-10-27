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

### 3. Install docker

> This is the official docker installation process
Before installing docker let's remove any kind of file that might interfere with the installation

```bash
sudo apt remove $(dpkg --get-selections docker.io docker-compose docker-compose-v2 docker-doc docker-buildx podman-docker containerd runc | cut -f1)
```

#### 3.2 Setup docker apt repo's

```bash
# Add Docker's official GPG key:
sudo apt update
sudo apt install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources:
sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update
```

#### 3.3 Install docker

```bash
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

#### 3.4 Make sure docker is working (optional)

```bash
sudo docker run hello-world
```

### 4. Clone the repository

```bash
git clone https://github.com/Mrzmiless/schoolcore-pap.git
cd schoolcore-pap
```

### 5. Finish setup

*Additional setup instructions will be added as the project evolves.*

## Contributing

Contributions are welcome! Feel free to open an issue to report bugs or suggest features, or submit a pull request with your improvements.

## License

This project is licensed under the terms of the [LICENSE](./LICENSE) file.