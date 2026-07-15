# Connect the display to Wi-Fi

The display creates a temporary setup network when it cannot connect to Wi-Fi.
You do not need to enter your home Wi-Fi password in the VESP editor.

## Connect the display

1. Install your project and power on the display.
2. Wait about 90 seconds for the display's setup network to appear.
3. On a phone or computer, open the list of available Wi-Fi networks and select
   the network named after your display.
4. The setup network does not require a password.
5. The Wi-Fi setup page should open automatically. If it does not, open
   [http://192.168.4.1/](http://192.168.4.1/) in a browser.
6. Select your home Wi-Fi network, enter its password, and save the settings.
7. Reconnect your phone or computer to its usual network. The display stores
   the credentials locally and connects to Home Assistant over your home
   network.

::: tip Credentials stay local
Wi-Fi provisioning happens directly between your browser and the display. Your
network password is not sent to or stored by VESP Cloud.
:::

## Change the Wi-Fi network

If the display can no longer connect to its saved network, wait for the setup
network to return and repeat the steps above.
