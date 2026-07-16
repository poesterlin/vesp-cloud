# Build and install your project

Once your dashboard is ready, build it and install it on the display.

## Build the project

1. Select **Deploy** in the editor toolbar.
2. On the deployment page, select **Update Display**.
3. Review the build confirmation. Each cloud build costs one credit.
4. Select **Confirm & Compile**. The build typically takes one to two minutes.
5. Wait for the completed build to appear in the build history.

::: tip Fix validation errors first
If the deployment page reports project issues, use **Go to issue** to return to
the affected widget and correct it before compiling again.
:::

## Install on the display

The first installation uses USB and requires Chrome or Edge.

1. Connect the display to the computer with a USB-C data cable. A charge-only
   cable will not work.
2. Select **Flash** on the completed build.
3. Select **Install to Device**.
4. When the browser asks you to choose a device, select your connected display.
5. Keep the display connected until installation finishes and the device
   restarts.

The build menu also lets advanced users download the installation file.

## Install future updates

After the first installation and Wi-Fi setup, future updates are available
through Home Assistant. You do not need to reconnect the USB cable.

1. Make your changes in the editor.
2. Open **Deploy**, select **Update Display**, and build the updated project.
3. When the update appears in Home Assistant, review and install it from the
   display's update entity.
4. Keep the display powered and connected to Wi-Fi while the update installs
   and the device restarts.

If the update does not appear automatically, open
[Home Assistant Updates](https://my.home-assistant.io/redirect/updates/) to check
for available updates directly.

::: tip No update shown?
Confirm that the display is online in Home Assistant and that the latest build
completed successfully, then reload the Updates page.
:::

[Next: connect the display to Wi-Fi →](./captive-portal)

[Need help? See troubleshooting →](./troubleshooting)
