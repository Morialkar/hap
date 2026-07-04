# Eusèbe v2 time capsule — Laravel 3 requires PHP 5.3/5.4:
# its helpers.php defines a function named `yield`, a reserved keyword since PHP 5.5,
# and the official php:5.4 images use manifest schema 1 (unpullable on Docker 28+).
# So: debian:wheezy (schema-2 rebuild) + PHP 5.4.45 from the Debian archives.
FROM debian:wheezy

ENV DEBIAN_FRONTEND=noninteractive

# Wheezy is EOL: archived repos + expired GPG keys → trusted=yes (local throwaway capsule)
RUN printf 'deb [trusted=yes] http://archive.debian.org/debian wheezy main\ndeb [trusted=yes] http://archive.debian.org/debian-security wheezy/updates main\n' \
      > /etc/apt/sources.list \
 && apt-get -o Acquire::Check-Valid-Until=false update \
 && apt-get install -y --force-yes --no-install-recommends \
      apache2 libapache2-mod-php5 php5-cli \
      php5-mysql php5-mcrypt \
 && rm -rf /var/lib/apt/lists/* \
 && a2enmod rewrite \
 && php -v

# Apache 2.2 vhost: docroot = the repo's public/, .htaccess enabled
RUN printf 'ServerName localhost\n<VirtualHost *:80>\n\tDocumentRoot /var/www/html/public\n\t<Directory /var/www/html/public>\n\t\tOptions FollowSymLinks\n\t\tAllowOverride All\n\t\tOrder allow,deny\n\t\tAllow from all\n\t</Directory>\n</VirtualHost>\n' \
      > /etc/apache2/sites-available/default

EXPOSE 80
CMD ["/bin/bash", "-c", ". /etc/apache2/envvars && exec apache2 -D FOREGROUND"]
