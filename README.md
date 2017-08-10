Housing Data Hub
===============
The Sacramento Housing Data Hub was inspired by a desire to provide community members with a common set of facts and data surrounding the complex issue of housing affordability in the Sacramento area. The site, a work in progress, is a comprehensive website to help Sacramento area residents understand the housing market, including for-sale inventory, single-family detached and multi-family rentals, subsidized affordable units, and more. The site will feature housing data visualizations, the relationship between housing costs, vacancy rates, income, and the local economy, explore existing and potential policy solutions, and catalogue the ongoing discussion at the federal, state, and local level.



At its core, this is just a [Jekyll site that leverages open data APIs, CSV files and some great open source javascript libraries] to handle charting and visualization.

###Getting started
If you want to take a look on your own machine, here's how you can get up and running:

Do this the first time:

1. Fork and clone the repo to a directory on your machine
2. Make sure you have Ruby installed by running `ruby --version` You should have either `1.9.3` or `2.0.0` If you don't, follow [these installation instructions](https://www.ruby-lang.org/en/downloads/).
3. Get Bundler by running `gem install bundler`. Bundler is a package mangager that makes versioning Ruby software a lot easier.
4. Now issue the command `bundle install` in the cloned repo root directory, this will set you up with Jekyll and the key dependencies

To run the site on your machine:

Issue the command `bundle exec jekyll serve` and the site should be available at `http://localhost:4000`

Check out the Jekyll documentation [here](http://jekyllrb.com/docs/usage/) and the Github Pages documentation [here](https://help.github.com/articles/using-jekyll-with-pages/) for more.
